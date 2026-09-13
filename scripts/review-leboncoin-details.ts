import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import { decideLeboncoinDetail, extractLeboncoinDetail, extractNextDataJson } from "../src/lib/sources/leboncoin/detailReview";

type CheckpointEntry = { reviewedAt: string; outcome: "reviewed" | "retry"; detail?: string };
type Checkpoint = { version: 1; listings: Record<string, CheckpointEntry> };

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const delayMs = Math.max(500, Number(arg("delay-ms") ?? 1800));
const limit = Math.max(1, Number(arg("limit") ?? Number.MAX_SAFE_INTEGER));
const checkpointPath = arg("checkpoint") ?? ".harvest/leboncoin-detail-review.json";
const reset = process.argv.includes("--reset");
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadCheckpoint(): Promise<Checkpoint> {
  if (reset) return { version: 1, listings: {} };
  try { return JSON.parse(await readFile(checkpointPath, "utf8")); }
  catch { return { version: 1, listings: {} }; }
}

async function saveCheckpoint(checkpoint: Checkpoint) {
  await mkdir(path.dirname(checkpointPath), { recursive: true });
  const temporary = `${checkpointPath}.tmp`;
  await writeFile(temporary, JSON.stringify(checkpoint, null, 2), "utf8");
  await rename(temporary, checkpointPath);
}

async function main() {
  const checkpoint = await loadCheckpoint();
  const source = await prisma.propertySource.findUnique({ where: { key: "leboncoin-bulk" }, select: { id: true } });
  if (!source) throw new Error("Leboncoin source is not configured");
  const listings = await prisma.listing.findMany({
    where: { sourceId: source.id, status: "ACTIVE" },
    select: { id: true, externalId: true, url: true, price: true, review: { select: { outcome: true } }, property: { select: { surface: true } } },
    orderBy: { externalId: "asc" },
  });
  const pending = listings.filter((listing) => reset || listing.review?.outcome !== "ACTIVE").slice(0, limit);
  const stats = { total: listings.length, pending: pending.length, reviewed: 0, withdrawn: 0, retry: 0, priceChanges: 0 };

  for (const [index, listing] of pending.entries()) {
    const url = listing.url ?? `https://www.leboncoin.fr/ad/ventes_immobilieres/${listing.externalId}`;
    try {
      const response = await fetch(url, { headers: { "accept-language": "fr-FR,fr;q=0.9", "user-agent": "Mozilla/5.0 (compatible; IDFInvestmentRadar/1.0; local listing verifier)" }, redirect: "follow" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const evidence = extractLeboncoinDetail(extractNextDataJson(await response.text()), listing.externalId);
      if (!evidence) throw new Error("matching structured advert evidence missing");
      const decision = decideLeboncoinDetail(evidence, listing.property.surface ?? 0);
      const fingerprint = createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
      const reviewReasons = decision.reasons.length
        ? decision.reasons
        : decision.status === "WITHDRAWN" ? [`SOURCE_STATUS:${evidence.sourceStatus}`] : [];
      await prisma.$transaction(async (tx) => {
        await tx.listing.update({
          where: { id: listing.id },
          data: { title: evidence.title || null, description: evidence.description || null, price: evidence.priceCents, status: decision.status, lastSeenAt: new Date() },
        });
        if (evidence.priceCents !== listing.price) {
          await tx.priceHistory.create({ data: { listingId: listing.id, price: evidence.priceCents } });
        }
        await tx.listingReview.upsert({
          where: { listingId: listing.id },
          update: { outcome: decision.status, reasons: JSON.stringify(reviewReasons), reviewedAt: new Date(), fingerprint, sourceStatus: evidence.sourceStatus, attempts: { increment: 1 }, lastError: null },
          create: { listingId: listing.id, outcome: decision.status, reasons: JSON.stringify(reviewReasons), fingerprint, sourceStatus: evidence.sourceStatus },
        });
      });
      checkpoint.listings[listing.externalId] = { reviewedAt: new Date().toISOString(), outcome: "reviewed", detail: reviewReasons.join(",") || decision.status };
      stats.reviewed++;
      if (decision.status === "WITHDRAWN") stats.withdrawn++;
      if (evidence.priceCents !== listing.price) stats.priceChanges++;
    } catch (error) {
      // Network blocks, throttling and parse failures are not evidence that an
      // advert is invalid. Leave the row ACTIVE and retry it on the next run.
      checkpoint.listings[listing.externalId] = { reviewedAt: new Date().toISOString(), outcome: "retry", detail: String(error) };
      await prisma.listingReview.upsert({
        where: { listingId: listing.id },
        update: { outcome: "RETRY", reviewedAt: new Date(), attempts: { increment: 1 }, lastError: String(error) },
        create: { listingId: listing.id, outcome: "RETRY", lastError: String(error) },
      });
      stats.retry++;
    }
    await saveCheckpoint(checkpoint);
    console.log(`${index + 1}/${pending.length}`, listing.externalId, checkpoint.listings[listing.externalId]);
    await wait(delayMs + Math.floor(Math.random() * Math.min(750, delayMs / 2)));
  }
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
