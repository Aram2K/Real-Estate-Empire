import { euroFromUnits } from "@/lib/format";
import { rampMagnitude, rampScore } from "./score";

export type MetricKey =
  | "hotspotScore"
  | "estGrossYield"
  | "medianPriceM2"
  | "medianRentM2"
  | "rentalDemandScore"
  | "transportScore"
  | "appreciationScore";

export interface MetricConfig {
  key: MetricKey;
  label: string;
  kind: "score" | "magnitude";
  domain: [number, number];
  valueOf: (p: Record<string, number | null>) => number | null;
  format: (v: number) => string;
  higherIsBetter: boolean;
  note: string;
}

const asScore = (n: number) => String(Math.round(n));

export const METRICS: MetricConfig[] = [
  {
    key: "hotspotScore",
    label: "Hotspot score",
    kind: "score",
    domain: [20, 90],
    valueOf: (p) => p.hotspotScore,
    format: asScore,
    higherIsBetter: true,
    note: "Composite of yield, demand, transport & appreciation",
  },
  {
    key: "estGrossYield",
    label: "Gross yield",
    kind: "score",
    domain: [3, 11],
    valueOf: (p) => (p.estGrossYield != null ? p.estGrossYield * 100 : null),
    format: (v) => `${v.toFixed(1)}%`,
    higherIsBetter: true,
    note: "Median rent ÷ median price (higher = better)",
  },
  {
    key: "rentalDemandScore",
    label: "Rental demand",
    kind: "score",
    domain: [20, 90],
    valueOf: (p) => p.rentalDemandScore,
    format: asScore,
    higherIsBetter: true,
    note: "Transport, jobs access, population & rent level",
  },
  {
    key: "transportScore",
    label: "Transport catalyst",
    kind: "score",
    domain: [10, 80],
    valueOf: (p) => p.transportScore,
    format: asScore,
    higherIsBetter: true,
    note: "Existing + future GPE stations & jobs access",
  },
  {
    key: "appreciationScore",
    label: "Appreciation (est.)",
    kind: "score",
    domain: [20, 90],
    valueOf: (p) => p.appreciationScore,
    format: asScore,
    higherIsBetter: true,
    note: "Estimated — not a forecast",
  },
  {
    key: "medianPriceM2",
    label: "Price €/m²",
    kind: "magnitude",
    domain: [2000, 12000],
    valueOf: (p) => (p.medianPriceM2 != null ? p.medianPriceM2 / 100 : null),
    format: (v) => euroFromUnits(v),
    higherIsBetter: false,
    note: "Median sale price per m² (DVF)",
  },
  {
    key: "medianRentM2",
    label: "Rent €/m²",
    kind: "magnitude",
    domain: [10, 32],
    valueOf: (p) => (p.medianRentM2 != null ? p.medianRentM2 / 100 : null),
    format: (v) => `€${v.toFixed(0)}`,
    higherIsBetter: true,
    note: "Median asking rent per m²/month",
  },
];

export function getMetric(key: MetricKey): MetricConfig {
  return METRICS.find((m) => m.key === key) ?? METRICS[0];
}

function ramp(cfg: MetricConfig): (t: number) => string {
  return cfg.kind === "score" ? rampScore : rampMagnitude;
}

/** Fill colour for a commune feature under a metric; null if no data. */
export function colorForMetric(
  cfg: MetricConfig,
  props: Record<string, number | null>,
  domain: [number, number] = cfg.domain
): string | null {
  const v = cfg.valueOf(props);
  if (v == null) return null;
  const [lo, hi] = domain;
  const t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
  return ramp(cfg)(t);
}

/** Legend gradient (CSS) + tick labels for the active metric + domain. */
export function legendFor(
  cfg: MetricConfig,
  domain: [number, number] = cfg.domain
) {
  const rampFn = ramp(cfg);
  const gradient = `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1]
    .map((t) => rampFn(t))
    .join(", ")})`;
  const [lo, hi] = domain;
  const ticks = [0, 0.5, 1].map((t) => cfg.format(lo + (hi - lo) * t));
  return { gradient, ticks, note: cfg.note };
}

/** p5–p95 domain from the actual data, so colours use the full range. */
export function domainFromFeatures(
  cfg: MetricConfig,
  features: { properties?: Record<string, number | null> }[]
): [number, number] {
  const vals: number[] = [];
  for (const f of features) {
    const v = f.properties ? cfg.valueOf(f.properties) : null;
    if (v != null && Number.isFinite(v)) vals.push(v);
  }
  if (vals.length < 5) return cfg.domain;
  vals.sort((a, b) => a - b);
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
  const lo = q(0.05);
  const hi = q(0.95);
  return hi > lo ? [lo, hi] : cfg.domain;
}
