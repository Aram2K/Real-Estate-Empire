import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getProperties } from "@/lib/properties/query";
import { parseFilterParams, PRESETS } from "@/lib/filters/schema";
import { geocodeAddress } from "@/lib/geo/geocode";
import { computeAndStoreAnalysis } from "@/lib/properties/analyzeOne";
import { IDF_DEPARTMENTS } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const preset = sp.get("preset");
  const parsed = parseFilterParams(sp);
  const filter =
    preset && PRESETS[preset]
      ? {
          ...PRESETS[preset],
          includeDemo: parsed.includeDemo,
          limit: parsed.limit,
          departements: parsed.departements ?? PRESETS[preset].departements,
          roomCounts: parsed.roomCounts,
          roomsAtLeast: parsed.roomsAtLeast,
        }
      : parsed;
  const items = await getProperties(filter);
  return NextResponse.json({ count: items.length, items });
}

const ImportSchema = z.object({
  address: z.string().trim().min(3).max(500),
  priceEuros: z.number().finite().positive().max(20_000_000),
  surface: z.number().finite().positive().max(100_000),
  rooms: z.number().int().positive().optional(),
  propertyType: z.enum(["Appartement", "Maison"]).default("Appartement"),
  dpe: z.enum(["A", "B", "C", "D", "E", "F", "G"]).optional(),
  floor: z.number().int().optional(),
  hasElevator: z.boolean().optional(),
  chargesMonthlyEuros: z.number().nonnegative().optional(),
  taxeFonciereAnnualEuros: z.number().nonnegative().optional(),
  url: z.string().url().refine((url) => /^https?:\/\//i.test(url), "Use an HTTP or HTTPS URL").optional(),
  title: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const d = parsed.data;

  let geo;
  try {
    geo = await geocodeAddress(d.address);
  } catch {
    return NextResponse.json(
      { error: "The address service is temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }
  if (!geo || geo.lat == null) {
    return NextResponse.json(
      { error: "Could not geocode that address. Try adding the postcode/city." },
      { status: 422 }
    );
  }

  if (!geo.codeCommune || !IDF_DEPARTMENTS.some((dep) => geo.codeCommune!.startsWith(dep.code))) {
    return NextResponse.json({ error: "Please use an address in Île-de-France." }, { status: 422 });
  }
  const commune = await prisma.commune.findUnique({ where: { code: geo.codeCommune } });
  if (!commune) {
    return NextResponse.json({ error: "Market coverage for this commune has not been loaded. Run the commune ingestion before importing here." }, { status: 422 });
  }

  const source = await prisma.propertySource.upsert({
    where: { key: "manual" },
    update: { label: "Manual import" },
    create: { key: "manual", label: "Manual import", enabled: true },
  });

  const priceCents = Math.round(d.priceEuros * 100);
  const dedupeKey = `manual:${geo.codeCommune ?? "?"}:${Math.round(
    geo.lat * 1e4
  )}:${Math.round(geo.lon * 1e4)}:${d.surface}`;

  const property = await prisma.property.upsert({
    where: { dedupeKey },
    update: {
      addressLine: geo.label,
      codeCommune: geo.codeCommune,
      lat: geo.lat,
      lon: geo.lon,
      surface: d.surface,
      rooms: d.rooms ?? null,
      propertyType: d.propertyType,
      dpe: d.dpe ?? null,
      floor: d.floor ?? null,
      hasElevator: d.hasElevator ?? null,
    },
    create: {
      dedupeKey,
      addressLine: geo.label,
      codeCommune: geo.codeCommune,
      lat: geo.lat,
      lon: geo.lon,
      surface: d.surface,
      rooms: d.rooms ?? null,
      propertyType: d.propertyType,
      dpe: d.dpe ?? null,
      floor: d.floor ?? null,
      hasElevator: d.hasElevator ?? null,
      isDemo: false,
    },
  });

  const previousListing = await prisma.listing.findUnique({
    where: { sourceId_externalId: { sourceId: source.id, externalId: dedupeKey } },
  });
  const listing = await prisma.listing.upsert({
    where: {
      sourceId_externalId: { sourceId: source.id, externalId: dedupeKey },
    },
    update: {
      status: "ACTIVE",
      price: priceCents,
      charges: d.chargesMonthlyEuros != null ? Math.round(d.chargesMonthlyEuros * 100) : null,
      taxeFonciere:
        d.taxeFonciereAnnualEuros != null
          ? Math.round(d.taxeFonciereAnnualEuros * 100)
          : null,
      url: d.url ?? null,
      title: d.title ?? geo.label,
      lastSeenAt: new Date(),
      propertyId: property.id,
    },
    create: {
      sourceId: source.id,
      externalId: dedupeKey,
      price: priceCents,
      charges: d.chargesMonthlyEuros != null ? Math.round(d.chargesMonthlyEuros * 100) : null,
      taxeFonciere:
        d.taxeFonciereAnnualEuros != null
          ? Math.round(d.taxeFonciereAnnualEuros * 100)
          : null,
      url: d.url ?? null,
      title: d.title ?? geo.label,
      propertyId: property.id,
    },
  });

  if (!previousListing || previousListing.price !== priceCents) {
    await prisma.priceHistory.create({ data: { listingId: listing.id, price: priceCents } });
  }
  const analyzed = await computeAndStoreAnalysis(property.id);
  if (!analyzed) {
    return NextResponse.json({ error: "The listing was imported, but its analysis could not be calculated. Check its price and surface, then retry.", id: property.id }, { status: 422 });
  }
  const ownerId = process.env.OWNER_ID ?? "local";
  await prisma.savedProperty.upsert({
    where: { ownerId_propertyId: { ownerId, propertyId: property.id } },
    update: {},
    create: { ownerId, propertyId: property.id },
  });

  return NextResponse.json({ id: property.id, geocoded: geo.label });
}
