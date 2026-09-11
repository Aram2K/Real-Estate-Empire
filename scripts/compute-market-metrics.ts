/**
 * Compute per-commune / per-arrondissement MarketMetric rows: median €/m² and
 * percentiles from DVF, median rent €/m² from rent references, estimated gross
 * yield, 5-year price trend, and DVF sample size. This is the data behind the
 * hotspot map and works with zero listings.
 *
 * Segments: APT (apartments), HOUSE (houses), ALL (both). The map defaults to APT.
 */
import { prisma } from "../src/lib/db/prisma";
import { MARKET_PERIOD } from "../src/lib/constants";
import { log } from "./_lib/log";

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

interface RentRow {
  rentM2Pred: number;
  rentM2Low: number | null;
  rentM2High: number | null;
}

async function main() {
  log.step("Computing market metrics…");

  // rent lookup maps keyed by `${code}:${segment}`
  const rents = await prisma.rentReference.findMany();
  const rentMap = new Map<string, RentRow>();
  for (const r of rents) {
    if (!r.codeCommune) continue;
    const key = `${r.codeCommune}:${r.segment}`;
    // PARIS_QUARTIER (encadrement) takes precedence for Paris arrondissements
    if (!rentMap.has(key) || r.scope === "PARIS_QUARTIER") {
      rentMap.set(key, {
        rentM2Pred: r.rentM2Pred,
        rentM2Low: r.rentM2Low,
        rentM2High: r.rentM2High,
      });
    }
  }
  const aptRent = (code: string) =>
    rentMap.get(`${code}:ALL_APT`) ?? null;
  const houseRent = (code: string) => rentMap.get(`${code}:HOUSE`) ?? null;

  const communes = await prisma.commune.findMany({
    where: { code: { not: "75056" } }, // exclude Paris aggregate (arrondissements cover it)
    select: { code: true },
  });

  await prisma.marketMetric.deleteMany({ where: { period: MARKET_PERIOD } });

  let written = 0;
  for (const { code } of communes) {
    const comps = await prisma.saleComparable.findMany({
      where: { codeCommune: code },
      select: { prixM2: true, typeLocal: true, dateMutation: true },
    });

    const segments: {
      segment: string;
      prices: number[];
      byYear: Map<number, number[]>;
      rent: RentRow | null;
    }[] = [
      { segment: "APT", prices: [], byYear: new Map(), rent: aptRent(code) },
      { segment: "HOUSE", prices: [], byYear: new Map(), rent: houseRent(code) },
      { segment: "ALL", prices: [], byYear: new Map(), rent: aptRent(code) },
    ];

    for (const c of comps) {
      const year = c.dateMutation.getFullYear();
      const targets =
        c.typeLocal === "Appartement"
          ? ["APT", "ALL"]
          : c.typeLocal === "Maison"
            ? ["HOUSE", "ALL"]
            : ["ALL"];
      for (const seg of targets) {
        const s = segments.find((x) => x.segment === seg)!;
        s.prices.push(c.prixM2);
        const arr = s.byYear.get(year) ?? [];
        arr.push(c.prixM2);
        s.byYear.set(year, arr);
      }
    }

    for (const s of segments) {
      const sorted = [...s.prices].sort((a, b) => a - b);
      const median = percentile(sorted, 50);
      const rentPred = s.rent?.rentM2Pred ?? null;

      // skip empty segments that have neither price nor rent
      if (median == null && rentPred == null) continue;

      const estGrossYield =
        median != null && rentPred != null && median > 0
          ? (rentPred * 12) / median
          : null;

      // 5y price trend (CAGR) from per-year medians
      let priceTrend5y: number | null = null;
      const years = [...s.byYear.keys()].sort((a, b) => a - b);
      if (years.length >= 2) {
        const first = percentile([...s.byYear.get(years[0])!].sort((a, b) => a - b), 50)!;
        const last = percentile([...s.byYear.get(years[years.length - 1])!].sort((a, b) => a - b), 50)!;
        const span = years[years.length - 1] - years[0];
        if (first > 0 && span > 0) {
          priceTrend5y = (Math.pow(last / first, 1 / span) - 1) * 100;
        }
      }

      await prisma.marketMetric.create({
        data: {
          communeCode: code,
          period: MARKET_PERIOD,
          segment: s.segment,
          medianPriceM2: median,
          p25PriceM2: percentile(sorted, 25),
          p75PriceM2: percentile(sorted, 75),
          medianRentM2: rentPred,
          estGrossYield,
          dvfSampleSize: s.prices.length,
          priceTrend5y,
        },
      });
      written++;
    }
  }

  log.ok(`Market metrics written: ${written}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  log.error(String(e));
  await prisma.$disconnect();
  process.exit(1);
});
