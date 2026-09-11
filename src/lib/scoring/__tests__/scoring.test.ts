import { describe, expect, it } from "vitest";
import {
  appreciationScore,
  investmentScore,
  negotiationScore,
  rentalDemandScore,
  transportCatalystScore,
} from "@/lib/scoring";

describe("transportCatalystScore", () => {
  it("scores a well-served spot near a future station highly", () => {
    // existing<500 (+20) + future<500 (+30) + hub≤3km (+15) + 3 lines (+15) = 80
    const s = transportCatalystScore({
      nearestExistingStationM: 300,
      nearestFutureStationM: 400,
      futureStationOpeningYear: 2027,
      distinctNearbyLines: 3,
      nearestHubM: 1500,
    });
    expect(s).toBe(80);
  });

  it("is 0 with nothing nearby", () => {
    expect(
      transportCatalystScore({
        nearestExistingStationM: 5000,
        nearestFutureStationM: 8000,
        distinctNearbyLines: 0,
        nearestHubM: 20000,
      })
    ).toBe(0);
  });

  it("rewards a nearby future station in a currently-underserved spot", () => {
    const s = transportCatalystScore({
      nearestExistingStationM: 2000,
      nearestFutureStationM: 450,
      futureStationOpeningYear: 2027,
      distinctNearbyLines: 1,
      nearestHubM: 9000,
    });
    // +30 (future <500) +15 (big travel improvement) = 45
    expect(s).toBe(45);
  });
});

describe("rentalDemandScore", () => {
  it("is higher for a well-connected, populous, employment-rich commune", () => {
    const strong = rentalDemandScore({
      population: 90_000,
      nearestHubM: 1500,
      transportScore: 85,
      medianRentM2Cents: 2200,
    });
    const weak = rentalDemandScore({
      population: 3_000,
      nearestHubM: 14_000,
      transportScore: 10,
      medianRentM2Cents: 900,
    });
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeGreaterThan(60);
    expect(weak).toBeLessThan(30);
  });
});

describe("appreciationScore", () => {
  it("rewards affordability relative to the department", () => {
    const cheap = appreciationScore({
      transportScore: 70,
      nearestFutureStationM: 600,
      futureStationOpeningYear: 2027,
      communePriceM2Cents: 300_000, // €3,000/m²
      departmentMedianPriceM2Cents: 420_000, // 28% below
      priceTrend5yPct: 3,
      population: 50_000,
      nearestHubM: 4000,
      rentalDemandScore: 75,
    });
    const pricey = appreciationScore({
      transportScore: 70,
      nearestFutureStationM: 600,
      futureStationOpeningYear: 2027,
      communePriceM2Cents: 520_000, // above department median
      departmentMedianPriceM2Cents: 420_000,
      priceTrend5yPct: 3,
      population: 50_000,
      nearestHubM: 4000,
      rentalDemandScore: 75,
    });
    expect(cheap).toBeGreaterThan(pricey);
  });
});

describe("investmentScore", () => {
  it("does not let raw yield dominate weak fundamentals", () => {
    const highYieldWeakArea = investmentScore({
      monthlyCashFlowCents: 5_000,
      allInGrossYieldPct: 11,
      rentalDemandScore: 20,
      transportScore: 10,
      appreciationScore: 15,
      dpe: "F",
      population: 4_000,
    });
    const balanced = investmentScore({
      monthlyCashFlowCents: 8_000,
      allInGrossYieldPct: 8.6,
      rentalDemandScore: 80,
      transportScore: 85,
      appreciationScore: 78,
      dpe: "C",
      population: 80_000,
    });
    // A 10%+ yield in a weak area scores below an 8.6% property with strong
    // demand + transport (PRD §49).
    expect(balanced.score).toBeGreaterThan(highYieldWeakArea.score);
    expect(balanced.parts.allInGrossYield).toBeLessThan(
      highYieldWeakArea.parts.allInGrossYield
    );
  });

  it("exposes a full parts breakdown", () => {
    const r = investmentScore({
      monthlyCashFlowCents: 8_000,
      allInGrossYieldPct: 8.6,
      rentalDemandScore: 80,
      transportScore: 85,
      appreciationScore: 78,
      dpe: "C",
      population: 80_000,
    });
    expect(Object.keys(r.parts)).toEqual([
      "cashFlow",
      "allInGrossYield",
      "rentalDemand",
      "transportCatalyst",
      "appreciation",
      "propertyQuality",
      "resaleLiquidity",
      "safety",
    ]);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("omits safety from the weighting when no safety data exists", () => {
    // NeighborhoodMetric is not populated by any ingestion script, so
    // safetyScore is null for every property today. `weighted()` renormalises
    // over the parts it is given, so the remaining weights must still produce
    // the same score as an explicit no-safety weighting -- safety must not be
    // silently scored 0, which would drag every property down by its weight.
    const base = {
      monthlyCashFlowCents: 8_000,
      allInGrossYieldPct: 8.6,
      rentalDemandScore: 80,
      transportScore: 85,
      appreciationScore: 78,
      dpe: "C",
      population: 80_000,
    };
    const without = investmentScore(base);
    expect(without.parts.safety).toBeNull();

    const withZero = investmentScore({ ...base, safetyScore: 0 });
    expect(withZero.parts.safety).toBe(0);
    expect(withZero.score).toBeLessThan(without.score);

    const withGood = investmentScore({ ...base, safetyScore: 80 });
    expect(withGood.parts.safety).toBe(80);
    expect(withGood.score).toBeGreaterThanOrEqual(without.score - 1);
  });
});

describe("negotiationScore", () => {
  it("stacks seller-motivation signals", () => {
    const motivated = negotiationScore({
      daysOnMarket: 120,
      priceReductionCount: 2,
      totalReductionPct: 11,
      priceVsDvfPct: 16,
      dpe: "G",
      vacant: true,
      renovationNeeded: true,
      urgencyKeywords: true,
    });
    const fresh = negotiationScore({
      daysOnMarket: 5,
      priceReductionCount: 0,
      priceVsDvfPct: -5,
      dpe: "C",
    });
    expect(motivated).toBeGreaterThan(80);
    expect(fresh).toBe(0);
  });
});
