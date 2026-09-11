import { prisma } from "@/lib/db/prisma";
import { resolveAssumptions } from "@/lib/assumptions/resolve";
import { loadMarketMaps, buildAnalysisContext } from "@/lib/analysis/context";
import { analyzeListing } from "@/lib/analysis/service";
import { estimateOperating } from "@/lib/analysis/estimate";
import { computeNegotiationScenarios } from "@/lib/finance";
import type { ResolvedAssumptions } from "@/lib/finance/types";
import { loadSpatialRefs, nearestTransport } from "@/lib/geo/spatialRefs";
import { negotiationScore } from "@/lib/scoring";

export async function getPropertyDetail(
  id: string,
  overrides?: Partial<ResolvedAssumptions> | null
) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      commune: { select: { nom: true, departement: true, population: true } },
      listings: {
        orderBy: { price: "asc" },
        include: {
          source: { select: { key: true, label: true } },
          priceHistory: { orderBy: { observedAt: "asc" } },
        },
      },
    },
  });
  if (!property) return null;

  const active = property.listings.filter((l) => l.status === "ACTIVE");
  const listing = active[0] ?? property.listings[0];
  if (!listing || !property.surface) return null;

  const a = resolveAssumptions(overrides);
  const [maps, refs] = await Promise.all([loadMarketMaps(), loadSpatialRefs()]);

  const ctx = buildAnalysisContext(
    {
      priceCents: listing.price,
      surface: property.surface,
      rooms: property.rooms,
      propertyType: property.propertyType,
      dpe: property.dpe,
      hasElevator: property.hasElevator,
      floor: property.floor,
      lat: property.lat,
      lon: property.lon,
      codeCommune: property.codeCommune,
      chargesMonthlyCents: listing.charges,
      taxeFonciereAnnualCents: listing.taxeFonciere,
    },
    maps,
    refs
  );
  if (!ctx) return null;

  const analysis = analyzeListing(ctx, a);

  const operating = estimateOperating(property.surface, {
    chargesMonthlyCents: listing.charges,
    taxeFonciereAnnualCents: listing.taxeFonciere,
  });
  const negotiation = computeNegotiationScenarios(
    {
      priceCents: listing.price,
      rent: analysis.rent,
      operating,
      rentalDemandScore: analysis.areaScores.rentalDemand,
    },
    a
  );

  // DVF benchmark (commune APT median €/m²) + a few recent comparables
  const aptPrice = maps.aptPriceByCommune.get(property.codeCommune ?? "");
  const listingPerM2 = Math.round(listing.price / property.surface);
  const dvfMedianPerM2 = aptPrice?.medianPriceM2 ?? null;
  const discountVsDvfPct =
    dvfMedianPerM2 && dvfMedianPerM2 > 0
      ? ((dvfMedianPerM2 - listingPerM2) / dvfMedianPerM2) * 100
      : null;
  const estimatedMarketValueCents =
    dvfMedianPerM2 != null ? Math.round(dvfMedianPerM2 * property.surface) : null;

  const comps = property.codeCommune
    ? await prisma.saleComparable.findMany({
        where: {
          codeCommune: property.codeCommune,
          typeLocal: property.propertyType ?? "Appartement",
          surfaceBati: {
            gte: property.surface * 0.7,
            lte: property.surface * 1.3,
          },
        },
        orderBy: { dateMutation: "desc" },
        take: 6,
        select: {
          dateMutation: true,
          surfaceBati: true,
          prixM2: true,
          valeurFonciere: true,
        },
      })
    : [];

  const t =
    property.lat != null && property.lon != null
      ? nearestTransport({ lat: property.lat, lon: property.lon }, refs)
      : null;

  const negScore = negotiationScore({
    daysOnMarket: listing.daysOnMarket,
    priceReductionCount: Math.max(0, listing.priceHistory.length - 1),
    priceVsDvfPct: discountVsDvfPct != null ? -discountVsDvfPct : null,
    dpe: property.dpe,
  });

  return {
    property: {
      id: property.id,
      commune: property.commune?.nom ?? "—",
      communeCode: property.codeCommune,
      departement: property.commune?.departement ?? null,
      lat: property.lat,
      lon: property.lon,
      surface: property.surface,
      rooms: property.rooms,
      propertyType: property.propertyType,
      dpe: property.dpe,
      hasElevator: property.hasElevator,
      floor: property.floor,
      isDemo: property.isDemo,
      addressLine: property.addressLine,
    },
    listing: {
      id: listing.id,
      source: listing.source.label,
      sourceKey: listing.source.key,
      url: listing.url,
      title: listing.title,
      description: listing.description,
      sellerType: listing.sellerType,
      sellerName: listing.sellerName,
      publishedAt: listing.publishedAt,
      firstSeenAt: listing.firstSeenAt,
      priceCents: listing.price,
      chargesCents: listing.charges,
      taxeFonciereCents: listing.taxeFonciere,
      daysOnMarket: listing.daysOnMarket,
      priceHistory: listing.priceHistory.map((h) => ({
        observedAt: h.observedAt,
        priceCents: h.price,
      })),
    },
    assumptions: a,
    analysis,
    negotiation,
    negotiationScore: negScore,
    dvf: {
      listingPerM2Cents: listingPerM2,
      dvfMedianPerM2Cents: dvfMedianPerM2,
      discountVsDvfPct,
      estimatedMarketValueCents,
      comps: comps.map((c) => ({
        dateMutation: c.dateMutation,
        surface: c.surfaceBati,
        prixM2Cents: c.prixM2,
        valeurCents: c.valeurFonciere,
      })),
    },
    transport: t
      ? {
          station: t.station
            ? { name: t.station.item.nom, metres: Math.round(t.station.metres) }
            : null,
          future: t.future
            ? {
                name: t.future.item.name,
                line: t.future.item.line,
                openingLabel: t.future.item.openingLabel,
                openingYear: t.future.item.openingYear,
                sourceUrl: t.future.item.sourceUrl,
                metres: Math.round(t.future.metres),
              }
            : null,
          hub: t.hub
            ? { name: t.hub.item.name, metres: Math.round(t.hub.metres) }
            : null,
        }
      : null,
  };
}

export type PropertyDetail = NonNullable<
  Awaited<ReturnType<typeof getPropertyDetail>>
>;
