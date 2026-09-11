import type { PropertyListItem } from "@/lib/properties/query";

// Town positions are display-only: never use them for property distance scoring.
export function groupMapListings(listings: PropertyListItem[]) {
  const groups = new Map<string, { key: string; lat: number; lon: number; approximate: boolean; items: PropertyListItem[] }>();
  const unlocated: PropertyListItem[] = [];
  for (const item of listings) {
    const approximate = item.lat == null || item.lon == null;
    const lat = approximate ? item.communeLat : item.lat;
    const lon = approximate ? item.communeLon : item.lon;
    if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      unlocated.push(item);
      continue;
    }
    const key = approximate ? `town:${item.communeCode}` : `point:${lat}:${lon}`;
    const group = groups.get(key) ?? { key, lat, lon, approximate, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return { groups: [...groups.values()], unlocated };
}
