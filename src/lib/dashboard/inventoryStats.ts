/**
 * Dashboard inventory statistics, computed on the server.
 *
 * The inventory panel used to receive every listing as a prop and compute these
 * figures in the browser, which serialized ~5,000 items (about 650 KB) into the
 * dashboard HTML. The figures only depend on the department and source the user
 * picks, and there are only a few dozen combinations, so they are precomputed
 * here and the panel looks them up.
 *
 * The calculations are the ones the component performed, moved unchanged, so
 * every number and every option order stays the same.
 */

export type InventoryPoint = {
  department: string;
  source: string;
  priceCents: number;
  propertyType: string;
};

export type NamedCount = { name: string; count: number };
export type PriceBandCount = { label: string; count: number };

export interface InventoryStats {
  /** Listings matching the selection; the panel shows the global active total for ALL/ALL. */
  filteredCount: number;
  medianPriceCents: number | null;
  averagePriceCents: number | null;
  houses: number;
  apartments: number;
  sourceCounts: NamedCount[];
  departmentCounts: NamedCount[];
  priceBands: PriceBandCount[];
}

export interface InventorySummary {
  /** Department options, sorted. */
  departments: string[];
  /** Source options, in order of first appearance among the ranked listings. */
  sources: string[];
  /** Keyed by `${department}|${source}`, each side "ALL" or an option value. */
  stats: Record<string, InventoryStats>;
}

export const ALL = "ALL";

export const statsKey = (department: string, source: string) => `${department}|${source}`;

export const sourceLabel = (source: string) =>
  source.startsWith("leboncoin") ? "Leboncoin" : source.startsWith("gensdeconfiance") ? "Gens de Confiance" : "Other sources";

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

const PRICE_BANDS = [
  { label: "Under €200k", min: 0, max: 20_000_000 },
  { label: "€200–400k", min: 20_000_000, max: 40_000_000 },
  { label: "€400–700k", min: 40_000_000, max: 70_000_000 },
  { label: "€700k–1m", min: 70_000_000, max: 100_000_000 },
  { label: "€1m+", min: 100_000_000, max: Infinity },
];

function computeStats(
  points: InventoryPoint[],
  departments: string[],
  sources: string[],
  department: string,
  source: string
): InventoryStats {
  const filtered = points.filter((point) =>
    (department === ALL || point.department === department) &&
    (source === ALL || sourceLabel(point.source) === source)
  );
  const priceValues = filtered.map((point) => point.priceCents);
  return {
    filteredCount: filtered.length,
    medianPriceCents: priceValues.length ? median(priceValues) : null,
    averagePriceCents: priceValues.length
      ? Math.round(priceValues.reduce((sum, value) => sum + value, 0) / priceValues.length)
      : null,
    houses: filtered.filter((point) => point.propertyType === "Maison").length,
    apartments: filtered.filter((point) => point.propertyType === "Appartement").length,
    sourceCounts: sources.map((name) => ({ name, count: filtered.filter((point) => sourceLabel(point.source) === name).length })),
    departmentCounts: departments
      .map((name) => ({ name, count: filtered.filter((point) => point.department === name).length }))
      .sort((a, b) => b.count - a.count),
    priceBands: PRICE_BANDS.map((band) => ({
      label: band.label,
      count: priceValues.filter((price) => price >= band.min && price < band.max).length,
    })),
  };
}

/** Every figure the inventory panel can show, for every selectable combination. */
export function summarizeInventory(points: InventoryPoint[]): InventorySummary {
  const departments = [...new Set(points.map((point) => point.department))].sort();
  const sources = [...new Set(points.map((point) => sourceLabel(point.source)))];
  const stats: Record<string, InventoryStats> = {};
  for (const department of [ALL, ...departments]) {
    for (const source of [ALL, ...sources]) {
      stats[statsKey(department, source)] = computeStats(points, departments, sources, department, source);
    }
  }
  return { departments, sources, stats };
}
