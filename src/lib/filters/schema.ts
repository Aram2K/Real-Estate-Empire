/** Property filter model + URL parsing + saved presets (PRD §20–21). */

export interface PropertyFilter {
  propertyIds?: string[];
  departements?: string[];
  communeCodes?: string[];
  priceMinCents?: number;
  priceMaxCents?: number;
  surfaceMin?: number;
  surfaceMax?: number;
  roomsMin?: number;
  roomsMax?: number;
  propertyType?: string[];
  sellerTypes?: string[];
  dpeMax?: string; // keep <= this rating (A best … G worst)
  grossYieldMin?: number;
  allInYieldMin?: number;
  cashFlowMinCents?: number;
  dscrMin?: number;
  whiteStatus?: string[];
  investmentScoreMin?: number;
  rentalDemandMin?: number;
  transportScoreMin?: number;
  appreciationMin?: number;
  safetyMin?: number;
  negotiationMin?: number;
  maxDistanceToStationM?: number;
  maxDistanceToGpeM?: number;
  nearGpeHorizonBy?: number; // opening year ≤ this
  includeDemo?: boolean;
  sort?: "investmentScore" | "cashFlow" | "grossYield" | "allInYield" | "dscr" | "price" | "safety";
  limit?: number;
}

const DPE_ORDER = ["A", "B", "C", "D", "E", "F", "G"];
export function dpeRank(dpe: string | null | undefined): number {
  if (!dpe) return 99;
  const i = DPE_ORDER.indexOf(dpe.toUpperCase());
  return i === -1 ? 99 : i;
}

function num(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function list(v: string | null): string[] | undefined {
  if (!v) return undefined;
  return v.split(",").map((x) => x.trim()).filter(Boolean);
}

/** Parse a filter from URL search params (euros in → cents stored). */
export function parseFilterParams(sp: URLSearchParams): PropertyFilter {
  const eurToCents = (v: string | null) => {
    const n = num(v);
    return n == null ? undefined : Math.round(n * 100);
  };
  return {
    departements: list(sp.get("departements")),
    communeCodes: list(sp.get("communeCodes")),
    priceMinCents: eurToCents(sp.get("priceMin")),
    priceMaxCents: eurToCents(sp.get("priceMax")),
    surfaceMin: num(sp.get("surfaceMin")),
    surfaceMax: num(sp.get("surfaceMax")),
    roomsMin: num(sp.get("roomsMin")),
    roomsMax: num(sp.get("roomsMax")),
    propertyType: list(sp.get("propertyType")),
    sellerTypes: list(sp.get("sellerTypes")),
    dpeMax: sp.get("dpeMax") ?? undefined,
    grossYieldMin: num(sp.get("grossYieldMin")),
    allInYieldMin: num(sp.get("allInYieldMin")),
    cashFlowMinCents: eurToCents(sp.get("cashFlowMin")),
    dscrMin: num(sp.get("dscrMin")),
    whiteStatus: list(sp.get("whiteStatus")),
    investmentScoreMin: num(sp.get("investmentScoreMin")),
    rentalDemandMin: num(sp.get("rentalDemandMin")),
    transportScoreMin: num(sp.get("transportScoreMin")),
    appreciationMin: num(sp.get("appreciationMin")),
    safetyMin: num(sp.get("safetyMin")),
    negotiationMin: num(sp.get("negotiationMin")),
    maxDistanceToStationM: num(sp.get("maxDistanceToStationM")),
    maxDistanceToGpeM: num(sp.get("maxDistanceToGpeM")),
    nearGpeHorizonBy: num(sp.get("nearGpeHorizonBy")),
    includeDemo: sp.get("includeDemo") === "false" ? false : true,
    sort: (sp.get("sort") as PropertyFilter["sort"]) ?? "investmentScore",
    limit: num(sp.get("limit")) ?? 300,
  };
}

export const PRESETS: Record<string, PropertyFilter> = {
  "full-white": {
    whiteStatus: ["FULL", "STRONG", "EXCELLENT"],
    cashFlowMinCents: 0,
    allInYieldMin: 8.5,
    dscrMin: 1.1,
    rentalDemandMin: 55,
    sort: "investmentScore",
  },
  "strong-white": {
    whiteStatus: ["STRONG", "EXCELLENT"],
    cashFlowMinCents: 10_000,
    dscrMin: 1.2,
    rentalDemandMin: 60,
    sort: "cashFlow",
  },
  "gpe-catalyst": {
    maxDistanceToGpeM: 900,
    nearGpeHorizonBy: 2028,
    appreciationMin: 55,
    sort: "appreciation" as PropertyFilter["sort"],
  },
};

export const PRESET_LABELS: Record<string, string> = {
  "full-white": "Full White Opportunities",
  "strong-white": "Strong White",
  "gpe-catalyst": "GPE Catalyst Plays",
};
