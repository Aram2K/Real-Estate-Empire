import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PLANNED_LINES } from "@/lib/geo/plannedTransit";

export async function GET() {
  const [existing, future, hubs] = await Promise.all([
    prisma.station.findMany({
      select: { id: true, nom: true, modes: true, lines: true, lat: true, lon: true },
    }),
    prisma.futureTransportProject.findMany({
      select: {
        id: true,
        name: true,
        line: true,
        segment: true,
        lat: true,
        lon: true,
        openingYear: true,
        openingLabel: true,
        status: true,
        confidence: true,
        sourceUrl: true,
      },
    }),
    prisma.employmentHub.findMany({
      select: { id: true, name: true, type: true, jobsCount: true, lat: true, lon: true },
    }),
  ]);

  return NextResponse.json({ existing, future, hubs, plannedLines: PLANNED_LINES });
}
