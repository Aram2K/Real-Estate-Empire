import { classifySuspiciousListing, type SuspiciousReason } from "../listingQuality";

type JsonObject = Record<string, unknown>;

export type LeboncoinDetailEvidence = {
  externalId: string;
  title: string;
  description: string;
  priceCents: number;
  sourceStatus: string | null;
};

export type DetailReviewDecision = {
  status: "ACTIVE" | "WITHDRAWN";
  reasons: SuspiciousReason[];
};

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function findAdvert(value: unknown, externalId: string): JsonObject | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAdvert(item, externalId);
      if (found) return found;
    }
    return null;
  }
  const candidate = object(value);
  if (!candidate) return null;
  const id = candidate.list_id ?? candidate.id;
  if (id != null && String(id) === externalId &&
      (typeof candidate.subject === "string" || typeof candidate.body === "string")) return candidate;
  for (const child of Object.values(candidate)) {
    const found = findAdvert(child, externalId);
    if (found) return found;
  }
  return null;
}

export function extractNextDataJson(html: string): unknown | null {
  const match = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

/** Extract only facts explicitly present in the requested advert's payload. */
export function extractLeboncoinDetail(payload: unknown, externalId: string): LeboncoinDetailEvidence | null {
  const ad = findAdvert(payload, externalId);
  if (!ad) return null;
  const title = typeof ad.subject === "string" ? ad.subject.trim() : "";
  const description = typeof ad.body === "string" ? ad.body.trim() : "";
  const rawPrice = Array.isArray(ad.price) ? ad.price[0] : ad.price;
  const euros = Number(rawPrice);
  if ((!title && !description) || !Number.isFinite(euros) || euros <= 0) return null;
  return {
    externalId,
    title,
    description,
    priceCents: Math.round(euros * 100),
    sourceStatus: typeof ad.status === "string" ? ad.status : null,
  };
}

export function decideLeboncoinDetail(
  evidence: LeboncoinDetailEvidence,
  surface: number,
): DetailReviewDecision {
  const quality = classifySuspiciousListing({
    title: evidence.title,
    description: evidence.description,
    priceCents: evidence.priceCents,
    surface,
  });
  const explicitlyInactive = evidence.sourceStatus != null &&
    ["inactive", "deleted", "expired", "withdrawn", "sold"].includes(evidence.sourceStatus.toLowerCase());
  return {
    status: quality.suspicious || explicitlyInactive ? "WITHDRAWN" : "ACTIVE",
    reasons: quality.reasons,
  };
}
