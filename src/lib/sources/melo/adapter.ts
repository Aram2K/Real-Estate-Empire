/**
 * Melo / Stream.Estate licensed listings adapter.
 *
 * The API is API-Platform / Hydra JSON-LD: list responses carry `hydra:member`
 * (the documents) and `hydra:view['hydra:next']` (pagination). Auth is the
 * `X-API-KEY` header. The adapter is env-gated — with no key (or no account
 * credits) it simply returns nothing and the app runs on open data + demo +
 * manual import.
 *
 * NOTE: the exact per-document field names should be finalised against a live
 * sample once the account has credits (docs.stream.estate). The mapper below is
 * defensive and tries the common field names.
 */
import type {
  FetchParams,
  ListingSourceAdapter,
  NormalizedListing,
} from "../types";

const BASE = "https://api.stream.estate";

function pick<T>(obj: Record<string, unknown>, keys: string[]): T | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (v != null) return v as T;
  }
  return undefined;
}

function mapPropertyType(v: unknown): "Appartement" | "Maison" | null {
  const s = String(v ?? "").toLowerCase();
  if (/(flat|apartment|appartement)/.test(s)) return "Appartement";
  if (/(house|maison|villa)/.test(s)) return "Maison";
  return null;
}

function toCents(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function toDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const date = new Date(v);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapDocument(doc: Record<string, unknown>): NormalizedListing | null {
  const priceEuros = pick<number>(doc, ["price", "amount", "salePrice"]);
  const priceCents = toCents(priceEuros);
  if (priceCents == null) return null;

  const loc = (pick<Record<string, unknown>>(doc, ["location", "geo", "point"]) ??
    {}) as Record<string, unknown>;
  const lat = pick<number>(doc, ["latitude", "lat"]) ?? pick<number>(loc, ["lat", "latitude"]);
  const lon =
    pick<number>(doc, ["longitude", "lng", "lon"]) ??
    pick<number>(loc, ["lng", "lon", "longitude"]);

  const externalId = String(
    pick(doc, ["id", "@id", "reference", "uuid"]) ?? `${lat},${lon},${priceCents}`
  );

  return {
    sourceKey: "melo",
    externalId,
    url: pick<string>(doc, ["url", "sourceUrl", "link"]) ?? null,
    title: pick<string>(doc, ["title", "name"]) ?? null,
    description: pick<string>(doc, ["description", "text"]) ?? null,
    priceCents,
    chargesMonthlyCents: toCents(pick(doc, ["charges", "condoFees"])),
    taxeFonciereAnnualCents: toCents(pick(doc, ["propertyTax", "taxeFonciere"])),
    surface: pick<number>(doc, ["surface", "area", "livingArea"]) ?? null,
    rooms: pick<number>(doc, ["rooms", "roomsCount", "nbRooms"]) ?? null,
    propertyType: mapPropertyType(pick(doc, ["propertyType", "type", "kind"])),
    dpe: pick<string>(doc, ["energyGrade", "dpe", "energyClass"]) ?? null,
    floor: pick<number>(doc, ["floor", "level"]) ?? null,
    hasElevator: pick<boolean>(doc, ["elevator", "hasElevator"]) ?? null,
    addressLine: pick<string>(doc, ["address", "city"]) ?? null,
    lat: lat ?? null,
    lon: lon ?? null,
    codeCommune:
      pick<string>(doc, ["inseeCode", "cityInseeCode", "citycode"])?.toString() ?? null,
    firstSeenAt: toDate(pick(doc, ["createdAt", "created_at", "indexedAt"])),
    publishedAt: toDate(pick(doc, ["publishedAt", "publicationDate", "firstPublicationDate"])),
    raw: doc,
  };
}

export const meloAdapter: ListingSourceAdapter = {
  key: "melo",
  label: "Melo / Stream.Estate",

  isAvailable() {
    return !!process.env.MELO_API_KEY;
  },

  async fetchListings(params: FetchParams): Promise<NormalizedListing[]> {
    const key = process.env.MELO_API_KEY;
    if (!key) return [];

    const out: NormalizedListing[] = [];
    const maxPages = params.maxPages ?? 5;

    const query = new URLSearchParams();
    query.set("transactionType", "sale");
    if (params.minPriceEuros) query.set("price[gte]", String(params.minPriceEuros));
    if (params.maxPriceEuros) query.set("price[lte]", String(params.maxPriceEuros));

    let url: string | null = `${BASE}/documents/properties?${query.toString()}`;
    let page = 0;

    while (url && page < maxPages) {
      const res: Response = await fetch(url, {
        headers: { "X-API-KEY": key, Accept: "application/ld+json" },
      });
      if (!res.ok) {
        // 403 = no credits / auth; stop quietly.
        break;
      }
      const json = (await res.json()) as {
        "hydra:member"?: Record<string, unknown>[];
        "hydra:view"?: { "hydra:next"?: string };
      };
      const members = json["hydra:member"] ?? [];
      for (const doc of members) {
        const mapped = mapDocument(doc);
        if (!mapped) continue;
        // department filter by INSEE code / postcode prefix
        if (params.departements.length && mapped.codeCommune) {
          const dep = mapped.codeCommune.slice(0, 2);
          if (!params.departements.includes(dep)) continue;
        }
        if (params.propertyTypes?.length && (!mapped.propertyType || !params.propertyTypes.includes(mapped.propertyType))) continue;
        out.push(mapped);
      }
      const next = json["hydra:view"]?.["hydra:next"];
      url = next ? (next.startsWith("http") ? next : `${BASE}${next}`) : null;
      page++;
    }

    return out.sort((a, b) => (b.publishedAt?.getTime() ?? b.firstSeenAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? a.firstSeenAt?.getTime() ?? 0));
  },
};
