/** Great-circle distance helpers. IDF scale is tiny, so brute force is fine. */

export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance in metres between two WGS-84 points. */
export function haversineMetres(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export interface NearestResult<T> {
  item: T;
  metres: number;
}

/** Nearest item (by haversine) from a list, or null if the list is empty. */
export function nearest<T extends LatLon>(
  from: LatLon,
  items: readonly T[]
): NearestResult<T> | null {
  let best: NearestResult<T> | null = null;
  for (const item of items) {
    const metres = haversineMetres(from, item);
    if (best === null || metres < best.metres) {
      best = { item, metres };
    }
  }
  return best;
}

/** All items within `radiusM` metres, nearest first. */
export function within<T extends LatLon>(
  from: LatLon,
  items: readonly T[],
  radiusM: number
): NearestResult<T>[] {
  const out: NearestResult<T>[] = [];
  for (const item of items) {
    const metres = haversineMetres(from, item);
    if (metres <= radiusM) out.push({ item, metres });
  }
  return out.sort((a, b) => a.metres - b.metres);
}
