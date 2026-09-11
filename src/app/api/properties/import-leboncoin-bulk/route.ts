import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { geocodeAddress } from "@/lib/geo/geocode";
import { parseSellerBadge } from "@/lib/sources/leboncoin/bulk";

type Card = {
  text?: string;
  url?: string;
  dpe?: string;
  /** Full street-number address only when the advert publicly provides it. */
  address?: string;
};
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function POST(request: Request) {
  const cards = await request.json() as Card[];
  if (!Array.isArray(cards) || cards.length > 500) return NextResponse.json({ error: "Invalid batch" }, { status: 400 });
  const communes = await prisma.commune.findMany({ select: { code: true, nom: true, departement: true } });
  const source = await prisma.propertySource.upsert({ where: { key: "leboncoin-bulk" }, update: { enabled: true }, create: { key: "leboncoin-bulk", label: "Leboncoin · public search results", enabled: true } });
  let imported = 0, skipped = 0;
  for (const card of cards) {
    const text = card.text?.replace(/\u00a0|\u202f/g, " ") ?? "";
    const ad = card.url?.match(/\/ad\/ventes_immobilieres\/(\d+)/);
    const price = text.match(/Prix:\s*([\d ]+)\s*€/i);
    const facts = text.match(/\b(Appartement|Maison)(?:\s+de\s+ville)?\s*·\s*(\d+)\s*pièces?\s*·\s*([\d.,]+)\s*m²/i);
    const place = text.match(/Située?\s+à\s+([^\n.]*?)\s+((?:7[578]|9[2345])\d{3})/i);
    if (!ad || !price || !facts || !place) { skipped++; continue; }
    const postal = place[2], dep = postal.slice(0, 2), city = norm(place[1]);
    const commune = postal.startsWith("75") ? communes.find(c => c.code === `751${postal.slice(-2)}`) : communes.find(c => c.departement === dep && norm(c.nom) === city) ?? communes.find(c => c.departement === dep && (norm(c.nom).includes(city) || city.includes(norm(c.nom))));
    if (!commune) { skipped++; continue; }
    const url = `https://www.leboncoin.fr/ad/ventes_immobilieres/${ad[1]}`;
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
    const property = await prisma.property.upsert({ where: { dedupeKey: `lbc:${ad[1]}` }, update: { codeCommune: commune.code, surface: Number(facts[3].replace(",", ".")), rooms: Number(facts[2]), propertyType: facts[1], dpe: card.dpe?.match(/Classe énergie\s+([A-G])/i)?.[1] ?? null, isDemo: false, ...locationData }, create: { dedupeKey: `lbc:${ad[1]}`, codeCommune: commune.code, addressLine: exactLocation?.label ?? `${commune.nom} — exact address not published`, lat: exactLocation?.lat, lon: exactLocation?.lon, surface: Number(facts[3].replace(",", ".")), rooms: Number(facts[2]), propertyType: facts[1], dpe: card.dpe?.match(/Classe énergie\s+([A-G])/i)?.[1] ?? null, isDemo: false } });
    const priceCents = Number(price[1].replace(/\s/g, "")) * 100;
    // Leboncoin badges each advert pro/particulier. Only record what the
    // captured card actually states; never assume professional.
    const sellerType = parseSellerBadge(text);
    const listing = await prisma.listing.upsert({ where: { sourceId_externalId: { sourceId: source.id, externalId: ad[1] } }, update: { propertyId: property.id, url, price: priceCents, lastSeenAt: new Date(), status: "ACTIVE", sellerType }, create: { sourceId: source.id, externalId: ad[1], propertyId: property.id, url, price: priceCents, status: "ACTIVE", sellerType, title: `${facts[2]}P · ${facts[3]} m² · ${commune.nom}`, description: "Public search result observed on Leboncoin. Availability and exact address must be confirmed with the advertiser." } });
    if (!await prisma.priceHistory.findFirst({ where: { listingId: listing.id }, select: { id: true } })) await prisma.priceHistory.create({ data: { listingId: listing.id, price: priceCents } });
    imported++;
  }
  return NextResponse.json({ received: cards.length, imported, skipped, total: await prisma.property.count({ where: { isDemo: false } }) });
}
