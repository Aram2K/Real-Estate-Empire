/**
 * Address geocoding via the Géoplateforme service (the current BAN endpoint;
 * api-adresse.data.gouv.fr is deprecated). Returns the commune code (citycode),
 * which for Paris is the arrondissement (75101–75120) — matching our commune keys.
 */
export interface GeocodeResult {
  lat: number;
  lon: number;
  codeCommune: string | null;
  label: string;
  type: string;
  score: number;
}

export async function geocodeAddress(
  query: string
): Promise<GeocodeResult | null> {
  const url = `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(
    query
  )}&limit=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const json = (await res.json()) as {
    features?: {
      geometry: { coordinates: [number, number] };
      properties: { citycode?: string; label: string; type: string; score: number };
    }[];
  };
  const f = json.features?.[0];
  if (!f) return null;
  const [lon, lat] = f.geometry.coordinates;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return {
    lat,
    lon,
    codeCommune: f.properties.citycode ?? null,
    label: f.properties.label,
    type: f.properties.type,
    score: f.properties.score,
  };
}
