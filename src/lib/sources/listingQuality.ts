export type ListingQualityInput = {
  title?: string | null;
  description?: string | null;
  priceCents?: number | null;
  surface?: number | null;
  propertyType?: string | null;
};

export type SuspiciousReason =
  | "NON_WHOLE_PROPERTY"
  | "ANCILLARY_SPACE_ONLY"
  | "NON_STANDARD_SALE"
  | "OCCUPIED_PROPERTY"
  | "IMPLAUSIBLE_PRICE"
  | "IMPLAUSIBLE_PRICE_PER_M2"
  | "IMPLAUSIBLE_SURFACE";

export type ListingQualityResult = {
  suspicious: boolean;
  reasons: SuspiciousReason[];
};

function normalized(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Conservative import-boundary screening for offers that are not a whole
 * dwelling or whose numeric fields cannot credibly describe an IDF sale.
 * Multiple explicit terms are preferred over broad words such as "occupied".
 */
export function classifySuspiciousListing(input: ListingQualityInput): ListingQualityResult {
  const title = normalized(input.title);
  const description = normalized(input.description);
  const text = `${title}\n${description}`;
  const reasons = new Set<SuspiciousReason>();

  const nonWholeProperty = [
    /\b(?:multipropriete|time[- ]?share|temps partage)\b/,
    /\b(?:droit de jouissance|droit d'occupation)\b.{0,50}\b(?:semaine|jours? par an|annuel)/,
    /\b(?:quote[- ]?part|part(?:s)? indivise(?:s)?|fraction (?:de propriete|du bien)|vente fractionnee|propriete fractionnee|vente de parts?)\b/,
    /\b(?:viager|nue[- ]?propriete|usufruit)\b/,
    /\b(?:demembrement|vente a terme)\b/,
    /\b(?:parts?|actions?)\s+(?:de|d')\s*(?:sci|societe immobiliere)\b/,
    /\bbouquet\b.{0,80}\b(?:rente|viager)\b|\brente\b.{0,80}\bviager\b/,
  ].some((pattern) => pattern.test(text));
  if (nonWholeProperty) reasons.add("NON_WHOLE_PROPERTY");

  if (/\b(?:vente aux encheres|adjudication|mise a prix|prix de depart|vente interactive|credit vendeur)\b/.test(text)) {
    reasons.add("NON_STANDARD_SALE");
  }

  if (/\b(?:vendu(?:e)? occupe(?:e)?|vente occupee|locataire en place|bail en cours|loue(?:e)? jusqu|occupation a vie)\b/.test(text)) {
    reasons.add("OCCUPIED_PROPERTY");
  }

  // Only treat ancillary space as the offer when the title identifies it as
  // the primary object. "Appartement avec parking et cave" remains valid.
  if (/^(?:(?:vente|cession)\s+(?:de\s+|d')?)?(?:un\s+|une\s+)?(?:lot\s+de\s+)?(?:parking|place de parking|stationnement|garage|box|cave|cellier|grenier)\b/.test(title)) {
    reasons.add("ANCILLARY_SPACE_ONLY");
  }

  const priceEuros = input.priceCents == null ? null : input.priceCents / 100;
  const surface = input.surface ?? null;
  if (surface != null && Number.isFinite(surface) && surface < 5) reasons.add("IMPLAUSIBLE_SURFACE");
  if (priceEuros != null && Number.isFinite(priceEuros)) {
    if (priceEuros > 30_000_000) {
      reasons.add("IMPLAUSIBLE_PRICE");
    }
    if (surface != null && surface > 0) {
      const pricePerM2 = priceEuros / surface;
      if (pricePerM2 > 100_000) {
        reasons.add("IMPLAUSIBLE_PRICE_PER_M2");
      }
      // Either low signal can be legitimate on its own. Require both for a
      // hard rejection.
      if (priceEuros < 10_000 && pricePerM2 < 300) {
        reasons.add("IMPLAUSIBLE_PRICE");
        reasons.add("IMPLAUSIBLE_PRICE_PER_M2");
      }
    }
  }

  return { suspicious: reasons.size > 0, reasons: [...reasons] };
}
