/** Listing source-adapter interface — Melo, manual and demo all implement it. */

export interface NormalizedListing {
  sourceKey: string; // "melo" | "manual" | "demo"
  externalId: string;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  priceCents: number;
  chargesMonthlyCents?: number | null;
  taxeFonciereAnnualCents?: number | null;
  surface?: number | null;
  rooms?: number | null;
  propertyType?: "Appartement" | "Maison" | null;
  dpe?: string | null;
  floor?: number | null;
  hasElevator?: boolean | null;
  addressLine?: string | null;
  lat?: number | null;
  lon?: number | null;
  codeCommune?: string | null;
  firstSeenAt?: Date | null;
  raw?: unknown;
}

export interface FetchParams {
  departements: string[];
  minPriceEuros?: number;
  maxPriceEuros?: number;
  propertyTypes?: ("Appartement" | "Maison")[];
  maxPages?: number;
}

export interface ListingSourceAdapter {
  readonly key: string;
  readonly label: string;
  isAvailable(): boolean;
  fetchListings(params: FetchParams): Promise<NormalizedListing[]>;
}
