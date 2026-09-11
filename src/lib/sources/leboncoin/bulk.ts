import type { SellerType } from "../sellerType";

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
 * Leboncoin badges every advert with its advertiser kind. When the captured card
 * text includes that badge we can record the seller for certain; when the
 * capture omitted it we record UNKNOWN rather than assuming professional.
 */
export function parseSellerBadge(text: string): SellerType {
  if (/(?:^|[\s·|>])particulier(?:[\s·|<]|$)/i.test(text)) return "INDIVIDUAL";
  if (/(?:^|[\s·|>])(?:pro|professionnel|boutique)(?:[\s·|<]|$)/i.test(text)) return "AGENCY";
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
  const place = text.match(/Située?\s+à\s+(.+?)\s+((?:7[578]|9[2345])\d{3})(?:\.|\s|$)/im);
  if (!ad || !price || !facts || !place) return null;

  const priceCents = Number(price[1].replace(/\s/g, "")) * 100;
  const surface = Number(facts[3].replace(",", "."));
  const rooms = Number(facts[2]);
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0 || !Number.isFinite(surface) || surface <= 0 || !Number.isInteger(rooms) || rooms <= 0) return null;

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
