import { nearest, type LatLon } from "./distance";

export type ParisRailAccessLevel = "HIGH_SPEED_DIRECT" | "INTERCITY_DIRECT" | "REGIONAL_DIRECT";

export interface ParisConnectedStation extends LatLon {
  nom: string;
  accessLevel: ParisRailAccessLevel;
}

/*
 * Conservative, maintainable classification of the main stations in the
 * collection markets. It records the kind of direct service to Paris, not a
 * journey time or a promise that every train is direct. Station coordinates
 * still come from SNCF's national passenger-station dataset.
 *
 * Source for station identity/coordinates:
 * https://ressources.data.sncf.com/explore/dataset/gares-de-voyageurs/
 * Service classes should be reviewed when the annual timetable changes.
 */
const ACCESS_BY_NORMALIZED_NAME: Readonly<Record<string, ParisRailAccessLevel>> = {
  rouenrivedroite: "INTERCITY_DIRECT",
  orleans: "REGIONAL_DIRECT",
  lesaubrais: "REGIONAL_DIRECT",
  reims: "HIGH_SPEED_DIRECT",
  champagneardennetgv: "HIGH_SPEED_DIRECT",
  amiens: "REGIONAL_DIRECT",
  troyes: "REGIONAL_DIRECT",
  lemans: "HIGH_SPEED_DIRECT",
  tours: "HIGH_SPEED_DIRECT",
  saintpierredescorps: "HIGH_SPEED_DIRECT",
  caen: "INTERCITY_DIRECT",
  chartres: "REGIONAL_DIRECT",
  evreuxnormandie: "INTERCITY_DIRECT",
  beauvais: "REGIONAL_DIRECT",
  compiegne: "REGIONAL_DIRECT",
  sens: "REGIONAL_DIRECT",
  auxerresaintgervais: "REGIONAL_DIRECT",
};

export function normalizeStationName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parisAccessLevelForStation(name: string): ParisRailAccessLevel | null {
  return ACCESS_BY_NORMALIZED_NAME[normalizeStationName(name)] ?? null;
}

export function nearestParisConnectedStation<T extends LatLon & { nom: string }>(
  point: LatLon,
  stations: readonly T[]
) {
  const connected: ParisConnectedStation[] = [];
  for (const station of stations) {
    const accessLevel = parisAccessLevelForStation(station.nom);
    if (accessLevel) connected.push({ ...station, accessLevel });
  }
  return nearest(point, connected);
}
