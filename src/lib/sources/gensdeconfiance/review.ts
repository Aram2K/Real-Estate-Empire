import { classifySuspiciousListing, type SuspiciousReason } from "../listingQuality";

export type GdcSourceReview = {
  externalId: string;
  url: string;
  sourceTitle: string;
  sourceDescription: string;
  reviewedAt: string;
  outcome: "KEEP" | "QUARANTINE";
  reasons: SuspiciousReason[];
};

export function externalIdFromGdcUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!/(?:^|\.)gensdeconfiance\.com$/i.test(url.hostname)) return null;
    return decodeURIComponent(url.pathname.match(/\/post\/realestate__sale\/([^/?#]+)/i)?.[1] ?? "").toLowerCase() || null;
  } catch {
    return null;
  }
}

/** Review source prose conservatively; quarantine requires explicit textual evidence. */
export function reviewGdcSource(input: { externalId: string; url: string; sourceTitle: string; sourceDescription: string; reviewedAt?: Date }): GdcSourceReview {
  const urlId = externalIdFromGdcUrl(input.url);
  if (!urlId || urlId !== input.externalId.toLowerCase()) throw new Error("GDC URL does not match externalId");
  const sourceTitle = input.sourceTitle.trim();
  const sourceDescription = input.sourceDescription.trim();
  if (!sourceTitle || !sourceDescription) throw new Error("Source title and description are required");
  const quality = classifySuspiciousListing({ title: sourceTitle, description: sourceDescription });
  // Numeric outliers are deliberately excluded here: a one-by-one review only
  // quarantines when the advert itself states a non-standard purchase type.
  const reasons = quality.reasons.filter((reason) => reason === "NON_WHOLE_PROPERTY" || reason === "ANCILLARY_SPACE_ONLY");
  return {
    externalId: input.externalId.toLowerCase(),
    url: input.url.split(/[?#]/)[0],
    sourceTitle,
    sourceDescription,
    reviewedAt: (input.reviewedAt ?? new Date()).toISOString(),
    outcome: reasons.length ? "QUARANTINE" : "KEEP",
    reasons,
  };
}

export function reviewedIdsFromJsonl(contents: string): Set<string> {
  const ids = new Set<string>();
  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as { externalId?: unknown };
      if (typeof value.externalId === "string") ids.add(value.externalId.toLowerCase());
    } catch {
      // An interrupted final write must not lose earlier checkpoints.
    }
  }
  return ids;
}
