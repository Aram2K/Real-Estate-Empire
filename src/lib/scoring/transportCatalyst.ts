import { clamp } from "./util";

export interface TransportInputs {
  /** metres to nearest currently-open station (null = none nearby). */
  nearestExistingStationM: number | null;
  /** metres to nearest future GPE station. */
  nearestFutureStationM: number | null;
  futureStationOpeningYear?: number | null;
  /** distinct lines (existing + future) within ~1 km. */
  distinctNearbyLines: number;
  /** metres to nearest major employment hub. */
  nearestHubM: number | null;
}

/**
 * Transport Catalyst Score (PRD §10). Additive, capped at 100.
 *
 *   existing station  <500 m → +20 ; 500–1000 m → +10
 *   future GPE        <500 m → +30 ; 500–1000 m → +20 ; 1–2 km → +10
 *   direct employment access (hub ≤ 3 km) → +15
 *   large travel-time gain (future station near, currently underserved) → +15
 *   multiple lines (≥2 nearby) → +10
 *
 * Note: being directly on top of a station also carries noise/nuisance, so
 * adjacency is not treated as strictly better than ~300 m — future work may add
 * a small nuisance adjustment.
 */
export function transportCatalystScore(i: TransportInputs): number {
  let s = 0;

  const ex = i.nearestExistingStationM;
  if (ex != null) {
    if (ex < 500) s += 20;
    else if (ex < 1000) s += 10;
  }

  const fu = i.nearestFutureStationM;
  if (fu != null) {
    if (fu < 500) s += 30;
    else if (fu < 1000) s += 20;
    else if (fu < 2000) s += 10;
  }

  if (i.nearestHubM != null && i.nearestHubM <= 3000) s += 15;

  // Big expected travel-time improvement: a future station is close but the
  // area is currently poorly served by existing rail.
  if (fu != null && fu < 1000 && (ex == null || ex > 1000)) s += 15;

  if (i.distinctNearbyLines >= 3) s += 15;
  else if (i.distinctNearbyLines >= 2) s += 10;

  return clamp(s);
}
