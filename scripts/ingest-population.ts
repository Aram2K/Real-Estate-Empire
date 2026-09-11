/**
 * Commune population municipale is already supplied by geo.api.gouv.fr during
 * commune ingest. The only gap is the 20 Paris arrondissements (geo.api returns
 * Paris as one aggregate, 75056). We fill those from INSEE populations
 * municipales (approx. latest census) so per-arrondissement scoring works.
 */
import { prisma } from "../src/lib/db/prisma";
import { log } from "./_lib/log";

// INSEE population municipale per Paris arrondissement (approx.).
const PARIS_ARR_POP: Record<number, number> = {
  1: 16_266,
  2: 20_900,
  3: 34_115,
  4: 27_769,
  5: 58_000,
  6: 40_916,
  7: 51_367,
  8: 36_453,
  9: 59_629,
  10: 90_449,
  11: 145_115,
  12: 141_494,
  13: 181_552,
  14: 137_105,
  15: 232_247,
  16: 165_446,
  17: 167_288,
  18: 195_060,
  19: 186_393,
  20: 195_119,
};

async function main() {
  log.step("Filling Paris arrondissement populations…");
  let n = 0;
  for (const [arrStr, pop] of Object.entries(PARIS_ARR_POP)) {
    const arr = Number(arrStr);
    const code = `751${String(arr).padStart(2, "0")}`;
    const updated = await prisma.commune.updateMany({
      where: { code },
      data: { population: pop },
    });
    n += updated.count;
  }
  log.ok(`Paris arrondissement populations set: ${n}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  log.error(String(e));
  await prisma.$disconnect();
  process.exit(1);
});
