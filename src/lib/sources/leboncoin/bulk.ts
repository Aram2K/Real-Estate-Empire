import type { SellerType } from "../sellerType";
import { classifySuspiciousListing } from "../listingQuality";
import { isCollectionPostalCode } from "../../constants";

export type LeboncoinCard = { text?: string; url?: string; dpe?: string };

export type ParsedLeboncoinCard = {
  externalId: string;
  url: string;
  price: number;
  propertyType: "Appartement" | "Maison";
  rooms: number;
  surface: number;
  city: string;
  postalCode: string;
  dpe: string | null;
  sellerType: SellerType;
};

/**
 * Leboncoin badges every advert with its advertiser kind: "Particulier" for a
 * private owner, "Pro"/"Professionnel"/"Boutique" for a trader. When the
 * captured card text carries that badge we record the seller for certain.
 *
 * IMPORTANT: when the capture omits the badge we return UNKNOWN rather than
 * assuming professional. Getting this wrong in the "pro" direction hides real
 * private sales from the Deals filter, which is the reason the filter exists.
 *
 * To capture the badge, include each card's full visible text in the import
 * payload -- the badge sits alongside the price and location line.
 */
export function parseSellerBadge(text: string): SellerType {
  // Normalise separators so a badge glued to punctuation still matches.
  const t = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  // "particulier" must not match "de particulier a particulier" inside agency
  // marketing copy, so require it to stand alone as a badge token.
  if (/(?:^|[\s>|·,;:\-\/\[\(])particulier(?:[\s<|·,;:\-\/\]\)]|$)/.test(t)) return "INDIVIDUAL";
  if (/(?:^|[\s>|·,;:\-\/\[\(])(?:pro|professionnel|professionnelle|boutique|agence)(?:[\s<|·,;:\-\/\]\)]|$)/.test(t)) return "AGENCY";
  return "UNKNOWN";
}

export type CommuneCandidate = { code: string; nom: string; departement: string };

export function normalizeCommuneName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:cedex|arrondissement)\b.*$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

export function parseLeboncoinCard(card: LeboncoinCard): ParsedLeboncoinCard | null {
  const text = card.text?.replace(/\u00a0|\u202f/g, " ") ?? "";
  const ad = card.url?.match(/\/ad\/ventes_immobilieres\/(\d+)/);
  const price = text.match(/Prix:\s*([\d ]+)\s*€/i);
  const facts = text.match(/\b(Appartement|Maison)(?:\s+de\s+ville)?\s*·\s*(\d+)\s*pièces?\s*·\s*([\d.,]+)\s*m²/i);
  const place = text.match(/Située?\s+à\s+(.+?)\s+(\d{5})(?:\.|\s|$)/im);
  if (!ad || !price || !facts || !place) return null;
  if (!isCollectionPostalCode(place[2])) return null;

  const priceCents = Number(price[1].replace(/\s/g, "")) * 100;
  const surface = Number(facts[3].replace(",", "."));
  const rooms = Number(facts[2]);
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0 || !Number.isFinite(surface) || surface <= 0 || !Number.isInteger(rooms) || rooms <= 0) return null;
  if (classifySuspiciousListing({
    title: text.split("\n").find((line) => /\b(?:Appartement|Maison|Parking|Garage|Cave|Box)\b/i.test(line)),
    description: text,
    priceCents,
    surface,
    propertyType: facts[1],
  }).suspicious) return null;

  return {
    externalId: ad[1],
    url: `https://www.leboncoin.fr/ad/ventes_immobilieres/${ad[1]}`,
    price: priceCents,
    propertyType: facts[1].toLowerCase() === "maison" ? "Maison" : "Appartement",
    rooms,
    surface,
    city: place[1].trim(),
    postalCode: place[2],
    dpe: card.dpe?.match(/Classe énergie\s+([A-G])/i)?.[1]?.toUpperCase() ?? null,
    sellerType: parseSellerBadge(text),
  };
}

export function createCommuneResolver(communes: CommuneCandidate[]) {
  const byCode = new Map(communes.map((c) => [c.code, c]));
  const exact = new Map<string, CommuneCandidate[]>();
  for (const commune of communes) {
    const key = `${commune.departement}:${normalizeCommuneName(commune.nom)}`;
    exact.set(key, [...(exact.get(key) ?? []), commune]);
  }

  return (cityName: string, postalCode: string): CommuneCandidate | undefined => {
    if (/^75(?:0[1-9]|1\d|20)$/.test(postalCode)) return byCode.get(`751${postalCode.slice(-2)}`);
    const department = postalCode.slice(0, 2);
    const city = normalizeCommuneName(cityName);
    const exactMatches = exact.get(`${department}:${city}`);
    if (exactMatches?.length === 1) return exactMatches[0];

    // Portal labels sometimes add a district or abbreviate Saint/Sainte. Only
    // accept a fuzzy result when it resolves to exactly one commune.
    const compactCity = city.replace(/^st(?=[a-z])/, "saint").replace(/^ste(?=[a-z])/, "sainte");
    const matches = communes.filter((c) => {
      if (c.departement !== department) return false;
      const name = normalizeCommuneName(c.nom).replace(/^st(?=[a-z])/, "saint").replace(/^ste(?=[a-z])/, "sainte");
      return name === compactCity || (Math.min(name.length, compactCity.length) >= 5 && (name.startsWith(compactCity) || compactCity.startsWith(name)));
    });
    return matches.length === 1 ? matches[0] : undefined;
  };
}
