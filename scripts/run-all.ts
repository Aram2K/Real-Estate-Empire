/**
 * Full ingestion pipeline in dependency order. Run once to build the database:
 *   npm run ingest:all
 *
 * Heads-up: ingest-dvf here pulls ALL 8 IDF departments for all 5 years, which
 * downloads a few hundred MB and takes several minutes. To build faster, run the
 * steps individually and pass a subset, e.g. `npm run ingest:dvf -- 93 92 --years 2024,2025`.
 */
import { execSync } from "node:child_process";
import { log } from "./_lib/log";

const STEPS: [string, string][] = [
  ["Communes + Paris arrondissements", "scripts/ingest-communes.ts"],
  ["GPE future stations", "scripts/seed-gpe.ts"],
  ["Employment hubs", "scripts/seed-employment-hubs.ts"],
  ["Rail stations", "scripts/ingest-stations.ts"],
  ["Paris arrondissement populations", "scripts/ingest-population.ts"],
  ["DVF transactions (all IDF, all years)", "scripts/ingest-dvf.ts"],
  ["Rent references", "scripts/ingest-rents.ts"],
  ["Market metrics", "scripts/compute-market-metrics.ts"],
  ["Area scores", "scripts/compute-scores.ts"],
  ["Demo listings", "scripts/seed-demo-listings.ts"],
  ["Investment analyses", "scripts/compute-analyses.ts"],
  ["Licensed listings (Melo, if configured)", "scripts/ingest-listings.ts"],
];

for (const [name, script] of STEPS) {
  log.step(`=== ${name} ===`);
  execSync(`npx tsx ${script}`, { stdio: "inherit" });
}
log.ok("Pipeline complete.");
