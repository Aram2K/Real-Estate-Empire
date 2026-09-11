import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { MARKET_PERIOD } from "@/lib/constants";
import { roundGeometry } from "@/lib/geo/simplify";

const cache = new Map<string, unknown>();

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment") ?? "APT";
  const cacheKey = `${segment}:${MARKET_PERIOD}`;
  if (cache.has(cacheKey)) {
    return NextResponse.json(cache.get(cacheKey));
  }

  const communes = await prisma.commune.findMany({
    where: { code: { not: "75056" }, geojson: { not: null } },
    select: { code: true, nom: true, departement: true, geojson: true },
  });
  const metrics = await prisma.marketMetric.findMany({
    where: { period: MARKET_PERIOD, segment },
  });
  const metricByCode = new Map(metrics.map((m) => [m.communeCode, m]));

  const features = [];
  for (const c of communes) {
    const m = metricByCode.get(c.code);
    if (!m) continue;
    let geometry: unknown;
    try {
      geometry = roundGeometry(JSON.parse(c.geojson!), 3);
    } catch {
      continue;
    }
    features.push({
      type: "Feature",
      properties: {
        code: c.code,
        nom: c.nom,
        departement: c.departement,
        medianPriceM2: m.medianPriceM2,
        medianRentM2: m.medianRentM2,
        estGrossYield: m.estGrossYield,
        priceTrend5y: m.priceTrend5y,
        hotspotScore: m.hotspotScore,
        transportScore: m.transportScore,
        appreciationScore: m.appreciationScore,
        rentalDemandScore: m.rentalDemandScore,
        dvfSampleSize: m.dvfSampleSize,
      },
      geometry,
    });
  }

  const fc = { type: "FeatureCollection", features };
  cache.set(cacheKey, fc);
  return NextResponse.json(fc);
}
