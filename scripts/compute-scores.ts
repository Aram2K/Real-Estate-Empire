/**
 * Compute area-level scores per commune and write them onto MarketMetric:
 * transport catalyst, rental demand, appreciation potential, and a composite
 * hotspot score for the choropleth. Purely geospatial + open-data driven — no
 * individual listings required.
 */
import { prisma } from "../src/lib/db/prisma";
import { MARKET_PERIOD } from "../src/lib/constants";
import {
  appreciationScore,
  clamp,
  linScore,
  rentalDemandScore,
  transportCatalystScore,
  weighted,
} from "../src/lib/scoring";
import { haversineMetres, nearest, within } from "../src/lib/geo/distance";
import { log } from "./_lib/log";

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const v = [...nums].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

async function main() {
  log.step("Computing area scores…");

  const stations = await prisma.station.findMany({
    select: { lat: true, lon: true, lines: true },
  });
  const futures = await prisma.futureTransportProject.findMany({
    select: { lat: true, lon: true, line: true, openingYear: true },
  });
  const hubs = await prisma.employmentHub.findMany({
    select: { lat: true, lon: true },
  });

  const communes = await prisma.commune.findMany({
    where: { code: { not: "75056" }, lat: { not: null }, lon: { not: null } },
    select: { code: true, lat: true, lon: true, population: true, departement: true },
  });

  const metrics = await prisma.marketMetric.findMany({
    where: { period: MARKET_PERIOD },
  });

  // APT metric per commune + department median APT €/m²
  const aptByCommune = new Map<string, (typeof metrics)[number]>();
  for (const m of metrics) {
    if (m.segment === "APT") aptByCommune.set(m.communeCode, m);
  }
  const deptToApt = new Map<string, number[]>();
  for (const c of communes) {
    const apt = aptByCommune.get(c.code);
    if (apt?.medianPriceM2 != null) {
      const arr = deptToApt.get(c.departement) ?? [];
      arr.push(apt.medianPriceM2);
      deptToApt.set(c.departement, arr);
    }
  }
  const deptMedianApt = new Map<string, number | null>();
  for (const [dep, arr] of deptToApt) deptMedianApt.set(dep, median(arr));

  let updated = 0;
  for (const c of communes) {
    const from = { lat: c.lat!, lon: c.lon! };

    const nearStation = nearest(from, stations);
    const nearFuture = nearest(from, futures);
    const nearHub = nearest(from, hubs);

    // distinct lines within 1 km (existing + future)
    const lineSet = new Set<string>();
    for (const s of within(from, stations, 1000)) {
      for (const l of s.item.lines.split(",")) if (l.trim()) lineSet.add(l.trim());
    }
    for (const f of within(from, futures, 1000)) lineSet.add(`GPE${f.item.line}`);

    const transport = transportCatalystScore({
      nearestExistingStationM: nearStation?.metres ?? null,
      nearestFutureStationM: nearFuture?.metres ?? null,
      futureStationOpeningYear: nearFuture?.item.openingYear ?? null,
      distinctNearbyLines: lineSet.size,
      nearestHubM: nearHub?.metres ?? null,
    });

    const apt = aptByCommune.get(c.code);
    const demand = rentalDemandScore({
      population: c.population,
      nearestHubM: nearHub?.metres ?? null,
      transportScore: transport,
      medianRentM2Cents: apt?.medianRentM2 ?? null,
    });

    const appreciation = appreciationScore({
      transportScore: transport,
      nearestFutureStationM: nearFuture?.metres ?? null,
      futureStationOpeningYear: nearFuture?.item.openingYear ?? null,
      communePriceM2Cents: apt?.medianPriceM2 ?? null,
      departmentMedianPriceM2Cents: deptMedianApt.get(c.departement) ?? null,
      priceTrend5yPct: apt?.priceTrend5y ?? null,
      population: c.population,
      nearestHubM: nearHub?.metres ?? null,
      rentalDemandScore: demand,
    });

    // write scores onto every segment metric of this commune; hotspot per-segment
    const rows = metrics.filter((m) => m.communeCode === c.code);
    for (const m of rows) {
      const yieldPct = m.estGrossYield != null ? m.estGrossYield * 100 : null;
      const parts: { score: number; weight: number }[] = [
        { score: demand, weight: 25 },
        { score: transport, weight: 25 },
        { score: appreciation, weight: 20 },
      ];
      if (yieldPct != null) {
        parts.push({ score: linScore(yieldPct, 4, 11), weight: 30 });
      }
      const hotspot = Math.round(clamp(weighted(parts)));

      await prisma.marketMetric.update({
        where: { id: m.id },
        data: {
          transportScore: transport,
          rentalDemandScore: demand,
          appreciationScore: appreciation,
          hotspotScore: hotspot,
        },
      });
      updated++;
    }
  }

  log.ok(`Scored metrics updated: ${updated}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  log.error(String(e));
  await prisma.$disconnect();
  process.exit(1);
});
