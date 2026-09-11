/**
 * Who is selling: a professional agency/mandataire, or a private individual?
 *
 * French portals price this difference in: a private sale ("de particulier à
 * particulier") carries no agency commission, which typically removes 3–6% from
 * the all-in acquisition cost and leaves more room to negotiate.
 *
 * We never guess. A listing is only labelled when there is an explicit signal —
 * the publisher's own domain, or the advert text naming the advertiser. Anything
 * else stays UNKNOWN so the Deals filter cannot silently hide real listings
 * behind an invented label.
 */

export type SellerType = "AGENCY" | "INDIVIDUAL" | "UNKNOWN";

export const SELLER_TYPES: SellerType[] = ["AGENCY", "INDIVIDUAL", "UNKNOWN"];

export const SELLER_TYPE_META: Record<
  SellerType,
  { label: string; short: string; color: string; bg: string; hint: string }
> = {
  AGENCY: {
    label: "Agency",
    short: "Agency",
    color: "#7c2d12",
    bg: "#fed7aa",
    hint: "Sold through a professional agency or mandataire — expect commission in the asking price.",
  },
  INDIVIDUAL: {
    label: "Private seller",
    short: "Private",
    color: "#134e4a",
    bg: "#99f6e4",
    hint: "Sold directly by the owner — no agency commission.",
  },
  UNKNOWN: {
    label: "Unknown seller",
    short: "Unknown",
    color: "#334155",
    bg: "#e2e8f0",
    hint: "The advert did not state whether the seller is an agency or a private individual.",
  },
};

/** Publisher domains that only ever carry professional listings. */
const AGENCY_DOMAINS = [
  "century21.fr",
  "laforet.com",
  "iadfrance.fr",
  "safti.fr",
  "capifrance.fr",
  "orpi.com",
  "foncia.com",
  "guyhoquet.com",
  "stephaneplaza-immobilier.com",
  "era-immobilier.fr",
  "nexity.fr",
  "square-habitat.fr",
  "leggett-immo.com",
  "bellesdemeures.com",
  "sothebysrealty.com",
];

/** Publisher domains that only ever carry private-individual listings. */
const INDIVIDUAL_DOMAINS = [
  "pap.fr", // Particulier À Particulier — individuals only, by definition
  "gensdeconfiance.com", // "entre particuliers" trusted-circle network
  "entreparticuliers.com",
  "immobilier-particulier.com",
];

/**
 * Portals carrying BOTH kinds. The domain says nothing; only the advert's own
 * pro/particulier badge does.
 */
const MIXED_PORTAL_DOMAINS = [
  "leboncoin.fr",
  "seloger.com",
  "bienici.com",
  "logic-immo.com",
  "paruvendu.fr",
  "figaro-immobilier.fr",
  "ouestfrance-immo.com",
];

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function domainMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isMixedPortal(url: string | null | undefined): boolean {
  const host = hostOf(url);
  return host != null && MIXED_PORTAL_DOMAINS.some((d) => domainMatches(host, d));
}

/**
 * Explicit pro/particulier wording. French portals label the advertiser, and our
 * reviewed batches record the publisher as "Leboncoin / <advertiser name>".
 */
const INDIVIDUAL_TEXT =
  /\b(particulier(?:\s+(?:a|à)\s+particulier)?|de\s+particulier|entre\s+particuliers|private\s+seller|owner\s+direct|vendu\s+par\s+le\s+propri(?:e|é)taire|sans\s+(?:agence|commission)|no\s+agency\s+fee)\b/i;

const AGENCY_TEXT =
  /\b(professionnel|professional|agence|agency|mandataire|honoraires?\s+(?:d[' ]?agence|charge)|r(?:e|é)f(?:\.|erence|érence)?\s+agence|agency\s+reference|n(?:e|é)gociateur|immobilier\s+(?:group|network))\b/i;

/**
 * Known agency / mandataire network names, for advert text that names the
 * advertiser without using the word "agence" (e.g. "Leboncoin / iad Sandrine L.").
 */
const AGENCY_NAME =
  /\b(century\s*21|laforet|laforêt|iad(?:\s|$)|safti|capifrance|orpi|foncia|guy\s*hoquet|st(?:e|é)phane\s+plaza|era\s+immobilier|nexity|square\s+habitat|expertimo|optimhome|dr\s*house|proprietes-privees|propri(?:e|é)t(?:e|é)s\s+priv(?:e|é)es|efficity|megagence|ciel\s*immo|human\s+immobilier|l[' ]?adresse|acheter-louer|immo\s*diffusion)\b/i;

/**
 * Sentences THIS APP generates at import time and stores in `Listing.description`.
 *
 * They must never be read as evidence about the seller. The Leboncoin bulk
 * importer writes "Public professional-sale result observed on Leboncoin"
 * unconditionally — that is an assumption made by the importer, not something
 * the advert stated. Classifying on it would turn our own guess into a fact and
 * mark every Leboncoin listing as an agency sale.
 */
const IMPORT_BOILERPLATE: RegExp[] = [
  /Public\s+professional-sale\s+result\s+observed\s+on\s+[^.]*\.?/gi,
  /Public\s+(?:agency\s+)?listing\s+on\s+[^.]*\s+reviewed\s+on\s+[^.]*\.?/gi,
  /Public\s+agency\s+listing\s+reviewed\s+on\s+[^.]*\.?/gi,
  /Availability(?:\s+and\s+(?:the\s+)?exact\s+address)?\s+(?:is\s+not|must\s+be)\s+confirmed[^.]*\.?/gi,
  /Exact\s+address(?:es)?\s+(?:was|were|is|are)\s+(?:unconfirmed|not\s+published)[^.]*\.?/gi,
  /the\s+map\s+can\s+use\s+an\s+approximate\s+town-centre\s+marker\.?/gi,
];

/** Remove app-generated sentences so only advert-derived text is classified. */
export function stripImportBoilerplate(text: string): string {
  return IMPORT_BOILERPLATE.reduce((acc, re) => acc.replace(re, " "), text)
    .replace(/\s+/g, " ")
    .trim();
}

export interface SellerClassification {
  type: SellerType;
  /** Advertiser name when the text names one; null otherwise. */
  name: string | null;
  /** Why we decided — kept for provenance, never invented. */
  reason: string;
}

/**
 * Classify the advertiser behind a listing.
 *
 * `explicit` wins when the import source states it outright (a portal badge, or
 * a reviewed record's `sellerType` field). Otherwise the publisher domain
 * decides, then the advert text. Mixed portals never fall through to a guess.
 */
export function classifySeller(input: {
  url?: string | null;
  text?: string | null;
  explicit?: string | null;
}): SellerClassification {
  const explicit = input.explicit?.trim().toUpperCase();
  if (explicit === "AGENCY" || explicit === "INDIVIDUAL") {
    return { type: explicit, name: null, reason: "stated by the source" };
  }

  const host = hostOf(input.url);
  if (host) {
    if (AGENCY_DOMAINS.some((d) => domainMatches(host, d))) {
      return { type: "AGENCY", name: null, reason: `publisher domain ${host}` };
    }
    if (INDIVIDUAL_DOMAINS.some((d) => domainMatches(host, d))) {
      return { type: "INDIVIDUAL", name: null, reason: `publisher domain ${host}` };
    }
  }

  const text = stripImportBoilerplate(input.text ?? "");
  if (text) {
    // An explicit "particulier" claim outranks agency wording, because agency
    // boilerplate ("honoraires") also appears on adverts that state no agency.
    if (INDIVIDUAL_TEXT.test(text)) {
      return { type: "INDIVIDUAL", name: null, reason: "advert text states a private seller" };
    }
    const named = text.match(AGENCY_NAME);
    if (named) {
      return {
        type: "AGENCY",
        name: advertiserName(text) ?? named[0].trim(),
        reason: `advert names ${named[0].trim()}`,
      };
    }
    if (AGENCY_TEXT.test(text)) {
      return { type: "AGENCY", name: advertiserName(text), reason: "advert text states a professional" };
    }
  }

  return { type: "UNKNOWN", name: null, reason: host ? `no seller signal on ${host}` : "no seller signal" };
}

/**
 * Pull the advertiser out of our reviewed-batch note convention,
 * "<Portal> / <Advertiser name>." — returns null when absent.
 */
export function advertiserName(text: string): string | null {
  const m = text.match(/^\s*(?:leboncoin|seloger|bien\s*ici|pap|paruvendu)\s*\/\s*([^.\n]{2,80})/im);
  return m ? m[1].trim() : null;
}

export function isSellerType(value: string): value is SellerType {
  return (SELLER_TYPES as string[]).includes(value);
}
