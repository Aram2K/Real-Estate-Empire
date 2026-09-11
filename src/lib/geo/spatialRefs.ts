import { prisma } from "@/lib/db/prisma";
import type { TransportInputs } from "@/lib/scoring";
import { nearest, within, type LatLon } from "./distance";

export interface SpatialRefs {
  stations: { lat: number; lon: number; lines: string; nom: string }[];
  futures: {
    lat: number;
    lon: number;
    line: string;
    openingYear: number | null;
    name: string;
    openingLabel: string;
    sourceUrl: string | null;
  }[];
  hubs: { lat: number; lon: number; name: string }[];
}

/** Load the small reference sets once; reuse across many point analyses. */
export async function loadSpatialRefs(): Promise<SpatialRefs> {
  const [stations, futures, hubs] = await Promise.all([
    prisma.station.findMany({
      select: { lat: true, lon: true, lines: true, nom: true },
    }),
    prisma.futureTransportProject.findMany({
      select: {
        lat: true,
        lon: true,
        line: true,
        openingYear: true,
        name: true,
        openingLabel: true,
        sourceUrl: true,
      },
    }),
    prisma.employmentHub.findMany({
      select: { lat: true, lon: true, name: true },
    }),
  ]);
  return { stations, futures, hubs };
}

/** Transport-score inputs for a single point (property-accurate). */
export function transportInputsForPoint(
  point: LatLon,
  refs: SpatialRefs
): TransportInputs {
  const nearStation = nearest(point, refs.stations);
  const nearFuture = nearest(point, refs.futures);
  const nearHub = nearest(point, refs.hubs);

  const lineSet = new Set<string>();
  for (const s of within(point, refs.stations, 1000)) {
    for (const l of s.item.lines.split(",")) if (l.trim()) lineSet.add(l.trim());
  }
  for (const f of within(point, refs.futures, 1000)) lineSet.add(`GPE${f.item.line}`);

  return {
    nearestExistingStationM: nearStation?.metres ?? null,
    nearestFutureStationM: nearFuture?.metres ?? null,
    futureStationOpeningYear: nearFuture?.item.openingYear ?? null,
    distinctNearbyLines: lineSet.size,
    nearestHubM: nearHub?.metres ?? null,
  };
}

/** Nearest existing station and future GPE station (with metadata) for a point. */
export function nearestTransport(point: LatLon, refs: SpatialRefs) {
  return {
    station: nearest(point, refs.stations),
    future: nearest(point, refs.futures),
    hub: nearest(point, refs.hubs),
  };
}
