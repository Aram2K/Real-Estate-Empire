import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { geocodeAddress } from "@/lib/geo/geocode";
import { parseSellerBadge } from "@/lib/sources/leboncoin/bulk";
import { isGensDeConfianceCard, parseGensDeConfianceCard } from "@/lib/sources/gensdeconfiance/bulk";
import type { SellerType } from "@/lib/sources/sellerType";
import { propertyFacts } from "@/lib/sources/propertyFacts";
import { classifySuspiciousListing } from "@/lib/sources/listingQuality";

type Card = {
  floor?: number;
  hasElevator?: boolean;
  publicationDate?: string;
  text?: string;
  title?: string;
  description?: string;
  url?: string;
  dpe?: string;
  /** Full street-number address only when the advert publicly provides it. */
  address?: string;
  /** Structured fields make large authenticated-browser batches independent of UI copy. */
  price?: number;
  propertyType?: string;
  rooms?: number;
  surface?: number;
  city?: string;
  postalCode?: string;
  sellerType?: SellerType;
  sellerName?: string;
  publishedAt?: string;
};
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const parseLeboncoinPublishedAt = (value?: string) => {
  if (!value) return null;
  // Leboncoin's embedded search payload omits the offset. Its displayed time is
  // French local time, so retain that wall-clock value with the applicable
  // mainland-France offset for the current collection season.
  const normalized = value.trim().replace(" ", "T");
  const month = Number(normalized.slice(5, 7));
  const offset = month >= 4 && month <= 10 ? "+02:00" : "+01:00";
  const parsed = new Date(`${normalized}${offset}`);
  return Number.isNaN(parsed.getTime()) || parsed > new Date() ? null : parsed;
};

export async function POST(request: Request) {
  const cards = await request.json() as Card[];
  if (!Array.isArray(cards) || cards.length > 2_000) return NextResponse.json({ error: "Invalid batch (maximum 2,000 cards)" }, { status: 400 });
  const communes = await prisma.commune.findMany({ select: { code: true, nom: true, departement: true } });
  const sources = {
    leboncoin: await prisma.propertySource.upsert({ where: { key: "leboncoin-bulk" }, update: { enabled: true }, create: { key: "leboncoin-bulk", label: "Leboncoin · public search results", enabled: true } }),
    gdc: await prisma.propertySource.upsert({ where: { key: "gensdeconfiance-browser" }, update: { enabled: true }, create: { key: "gensdeconfiance-browser", label: "Gens de Confiance · authenticated search results", enabled: true } }),
  };
  let imported = 0, skipped = 0;
  const sellers = { AGENCY: 0, INDIVIDUAL: 0, UNKNOWN: 0 } as Record<string, number>;
  for (const card of cards) {
    const text = [card.title, card.text, card.description]
      .filter(Boolean)
      .join("\n")
      .replace(/\u00a0|\u202f/g, " ");
    const lbcAd = card.url?.match(/\/ad\/ventes_immobilieres\/(\d+)/);
    if (isGensDeConfianceCard(card) && !card.description?.trim()) { skipped++; continue; }
    if (classifySuspiciousListing({ title: card.title, description: text }).suspicious) { skipped++; continue; }
    const parsedGdc = isGensDeConfianceCard(card) ? parseGensDeConfianceCard({ ...card, text }) : null;
    const gdc = !lbcAd && !!parsedGdc;
    const price = gdc ? text.match(/€\s*([\d, ]+)/i) : text.match(/Prix:\s*([\d ]+)\s*€/i);
    const lbcFacts = text.match(/\b(Appartement|Maison)(?:\s+de\s+ville)?\s*·\s*(\d+)\s*pièces?\s*·\s*([\d.,]+)\s*m²/i);
    const gdcFacts = text.match(/\b(Apartment|House)\s*·\s*([\d.,]+)\s*m²\s*·\s*(\d+)\s*rooms?/i);
    const place = gdc
      ? text.match(/\n\s*([^\n]+?)\s*\n+\s*\(((?:7[578]|9[2345])\d{3})\)/i)
      : text.match(/Située?\s+à\s+([^\n.]*?)\s+((?:7[578]|9[2345])\d{3})/i);
    if (!gdc && (!lbcAd || !price || !lbcFacts || !place)) { skipped++; continue; }
    const propertyType = parsedGdc?.propertyType ?? lbcFacts![1];
    const surface = parsedGdc?.surface ?? Number(lbcFacts![3].replace(",", "."));
    const rooms = parsedGdc?.rooms ?? Number(lbcFacts![2]);
    const postal = parsedGdc?.postalCode ?? place![2], dep = postal.slice(0, 2), city = norm(parsedGdc?.city ?? place![1]);
    const commune = postal.startsWith("75") ? communes.find(c => c.code === `751${postal.slice(-2)}`) : communes.find(c => c.departement === dep && norm(c.nom) === city) ?? communes.find(c => c.departement === dep && (norm(c.nom).includes(city) || city.includes(norm(c.nom))));
    if (!commune) { skipped++; continue; }
    const externalId = parsedGdc?.externalId ?? lbcAd![1];
    const url = parsedGdc?.url ?? `https://www.leboncoin.fr/ad/ventes_immobilieres/${externalId}`;
    let exactLocation: { lat: number; lon: number; label: string } | null = null;
    if (card.address?.trim()) {
      try {
        const geo = await geocodeAddress(card.address.trim());
        if (geo?.type === "housenumber" && geo.score >= 0.7 && geo.codeCommune === commune.code) {
          exactLocation = { lat: geo.lat, lon: geo.lon, label: geo.label };
        }
      } catch {
        // Keep the advert import; a temporary geocoder failure must not turn a
        // published address into an invented map point.
      }
    }
    const locationData = exactLocation
      ? { lat: exactLocation.lat, lon: exactLocation.lon, addressLine: exactLocation.label }
      : {};
    const dpe = parsedGdc?.dpe ?? card.dpe?.match(/Classe énergie\s+([A-G])/i)?.[1] ?? null;
    const property = await prisma.property.upsert({ where: { dedupeKey: `${gdc ? "gdc" : "lbc"}:${externalId}` }, update: { codeCommune: commune.code, surface, rooms, propertyType, dpe, isDemo: false, ...locationData }, create: { dedupeKey: `${gdc ? "gdc" : "lbc"}:${externalId}`, codeCommune: commune.code, addressLine: exactLocation?.label ?? `${commune.nom} — exact address not published`, lat: exactLocation?.lat, lon: exactLocation?.lon, surface, rooms, propertyType, dpe, isDemo: false } });
    const priceCents = parsedGdc?.price ?? Number(price![1].replace(/[\s,]/g, "")) * 100;
    // Leboncoin badges each advert pro/particulier. Only record what the
    // captured card actually states; never assume professional.
    const sellerType = parsedGdc?.sellerType ?? parseSellerBadge(text);
    sellers[sellerType]++;
    const source = gdc ? sources.gdc : sources.leboncoin;
    const sellerName = parsedGdc?.sellerName ?? null;
    const publishedAt = parsedGdc?.publishedAt ?? parseLeboncoinPublishedAt(card.publishedAt);
    const listing = await prisma.listing.upsert({ where: { sourceId_externalId: { sourceId: source.id, externalId } }, update: { propertyId: property.id, url, price: priceCents, lastSeenAt: new Date(), status: "ACTIVE", sellerType, sellerName, ...(publishedAt ? { publishedAt } : {}) }, create: { sourceId: source.id, externalId, propertyId: property.id, url, price: priceCents, status: "ACTIVE", sellerType, sellerName, publishedAt, title: `${rooms}P · ${surface} m² · ${commune.nom}`, description: `${gdc ? "Authenticated search result observed on Gens de Confiance" : "Public search result observed on Leboncoin"}. Availability and exact address must be confirmed with the advertiser.` } });
    if (!await prisma.priceHistory.findFirst({ where: { listingId: listing.id }, select: { id: true } })) await prisma.priceHistory.create({ data: { listingId: listing.id, price: priceCents } });
    imported++;
    await prisma.property.update({ where: { id: property.id }, data: propertyFacts(card.description ?? "", card.floor, card.hasElevator) });
    const publicationDate = card.publicationDate && /^\d{4}-\d{2}-\d{2}$/.test(card.publicationDate) ? card.publicationDate : undefined;
    await prisma.listing.update({ where: { id: listing.id }, data: {
      ...(card.title ? { title: card.title } : {}),
      ...(card.description ? { description: card.description } : {}),
      ...(publicationDate ? { publicationDate, ...(card.publishedAt ? {} : { publishedAt: null }) } : {}),
    } });
  }
  return NextResponse.json({
    received: cards.length,
    imported,
    skipped,
    sellers,
    sellerBadgeHint:
      imported === 0
        ? "Nothing was imported, so no seller badge was read."
        : sellers.UNKNOWN > 0
          ? `${sellers.UNKNOWN} of ${imported} advert(s) carried no Pro/Particulier badge and were saved as UNKNOWN. Include each card's full visible text (the badge sits near the price) to record the real seller.`
          : `All ${imported} advert(s) carried a seller badge.`,
    total: await prisma.property.count({ where: { isDemo: false } }),
  });
}
