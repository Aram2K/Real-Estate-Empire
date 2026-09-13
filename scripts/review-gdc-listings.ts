import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { reviewGdcSource, reviewedIdsFromJsonl } from "../src/lib/sources/gensdeconfiance/review";

const prisma = new PrismaClient();
const checkpoint = path.resolve("scripts/reviewed/gdc-source-reviews.jsonl");
const args = process.argv.slice(2);
const option = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };

async function checkpointContents() {
  try { return await readFile(checkpoint, "utf8"); } catch { return ""; }
}

async function queue() {
  const reviewed = reviewedIdsFromJsonl(await checkpointContents());
  const limit = Math.max(1, Math.min(500, Number(option("--limit") ?? 25)));
  const listings = await prisma.listing.findMany({
    where: { source: { key: "gensdeconfiance-browser" }, status: "ACTIVE", property: { isDemo: false } },
    select: { externalId: true, url: true, review: { select: { reviewedAt: true } } }, orderBy: { firstSeenAt: "asc" },
  });
  const pendingAll = listings.filter((listing) => !listing.review && !reviewed.has(listing.externalId.toLowerCase()));
  const pending = pendingAll.slice(0, limit).map(({ externalId, url }) => ({ externalId, url }));
  console.log(JSON.stringify({ reviewed: listings.length - pendingAll.length, active: listings.length, pending: pendingAll.length, next: pending }, null, 2));
}

async function record(file: string) {
  const raw = JSON.parse(await readFile(path.resolve(file), "utf8")) as { externalId: string; url: string; sourceTitle: string; sourceDescription: string };
  const review = reviewGdcSource(raw);
  const listing = await prisma.listing.findFirst({ where: { source: { key: "gensdeconfiance-browser" }, externalId: review.externalId }, select: { id: true } });
  if (!listing) throw new Error(`No GDC listing ${review.externalId}`);
  const fingerprint = createHash("sha256").update(JSON.stringify({ url: review.url, title: review.sourceTitle, description: review.sourceDescription })).digest("hex");
  await prisma.$transaction([
    prisma.listing.update({
      where: { id: listing.id },
      data: {
        title: review.sourceTitle,
        description: review.sourceDescription,
        status: review.outcome === "QUARANTINE" ? "WITHDRAWN" : "ACTIVE",
        lastSeenAt: new Date(review.reviewedAt),
      },
    }),
    prisma.listingReview.upsert({
      where: { listingId: listing.id },
      update: { outcome: review.outcome === "QUARANTINE" ? "WITHDRAWN" : "ACTIVE", reasons: JSON.stringify(review.reasons), reviewedAt: new Date(review.reviewedAt), fingerprint, sourceStatus: "AVAILABLE", attempts: { increment: 1 }, lastError: null },
      create: { listingId: listing.id, outcome: review.outcome === "QUARANTINE" ? "WITHDRAWN" : "ACTIVE", reasons: JSON.stringify(review.reasons), reviewedAt: new Date(review.reviewedAt), fingerprint, sourceStatus: "AVAILABLE" },
    }),
  ]);
  await mkdir(path.dirname(checkpoint), { recursive: true });
  await appendFile(checkpoint, `${JSON.stringify(review)}\n`, "utf8");
  console.log(JSON.stringify(review, null, 2));
}

try {
  const file = option("--record-file");
  if (file) await record(file); else await queue();
} finally {
  await prisma.$disconnect();
}
