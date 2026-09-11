import { prisma } from "../src/lib/db/prisma";
import { EMPLOYMENT_HUBS } from "../prisma/seed/employment-hubs";
import { log } from "./_lib/log";

async function main() {
  log.step("Seeding employment hubs…");
  for (const h of EMPLOYMENT_HUBS) {
    await prisma.employmentHub.upsert({
      where: { name: h.name },
      update: { type: h.type, jobsCount: h.jobsCount, lon: h.lon, lat: h.lat },
      create: {
        name: h.name,
        type: h.type,
        jobsCount: h.jobsCount,
        lon: h.lon,
        lat: h.lat,
      },
    });
  }
  log.ok(`Employment hubs seeded: ${EMPLOYMENT_HUBS.length}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  log.error(String(e));
  await prisma.$disconnect();
  process.exit(1);
});
