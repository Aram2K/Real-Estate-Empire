import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS } from "@/lib/assumptions/defaults";
import {
  analyzeProperty,
  classifyDscr,
  classifyWhiteOperation,
  computeAcquisitionCost,
  computeCashFlow,
  computeDscr,
  computeFinancing,
  computeMortgage,
  computeNegotiationScenarios,
  computeYields,
  pctOf,
} from "@/lib/finance";
import type {
  OperatingInputs,
  RentEstimate,
  ResolvedAssumptions,
} from "@/lib/finance/types";

const A = (o: Partial<ResolvedAssumptions> = {}): ResolvedAssumptions => ({
  ...DEFAULT_ASSUMPTIONS,
  ...o,
});

describe("pctOf", () => {
  it("computes a percentage of a cent amount, rounded", () => {
    expect(pctOf(15_000_000, 7.5)).toBe(1_125_000); // 7.5% of €150,000 = €11,250
    expect(pctOf(10_000, 5)).toBe(500);
  });
});

describe("computeMortgage", () => {
  it("handles a zero-rate loan as simple division", () => {
    const m = computeMortgage(12_000_000, A({ ratePct: 0, termYears: 25, insurancePct: 0 }));
    expect(m.monthlyPrincipalInterestCents).toBe(40_000); // €120,000 / 300
    expect(m.monthlyInsuranceCents).toBe(0);
    expect(m.monthlyTotalCents).toBe(40_000);
  });

  it("computes standard amortization for €130,000 @ 3.6% / 25y", () => {
    const m = computeMortgage(13_000_000, A({ ratePct: 3.6, termYears: 25, insurancePct: 0.3 }));
    // hand-computed P&I ≈ €657.80/mo
    expect(m.monthlyPrincipalInterestCents).toBeGreaterThan(65_680);
    expect(m.monthlyPrincipalInterestCents).toBeLessThan(65_880);
    // insurance = 0.3%/yr of principal / 12 = €32.50
    expect(m.monthlyInsuranceCents).toBe(3_250);
    expect(m.annualDebtServiceCents).toBe(m.monthlyTotalCents * 12);
  });

  it("returns zero for a zero principal", () => {
    const m = computeMortgage(0, A());
    expect(m.monthlyTotalCents).toBe(0);
  });
});

describe("computeAcquisitionCost + computeFinancing", () => {
  const price = 12_000_000; // €120,000

  it("sums fees into total investment cost", () => {
    const acq = computeAcquisitionCost(price, A({ notaryPct: 7.5, bankFeesCents: 100_000 }));
    expect(acq.notaryFeesCents).toBe(900_000); // €9,000
    expect(acq.totalInvestmentCents).toBe(price + 900_000 + 100_000); // €130,000
  });

  it("110% financing fully covers costs → €0 investor cash", () => {
    const a = A({ financingPct: 110, notaryPct: 7.5, bankFeesCents: 100_000 });
    const acq = computeAcquisitionCost(price, a);
    const fin = computeFinancing(acq, a);
    // loan = min(110% of €120,000 = €132,000, total €130,000) = €130,000
    expect(fin.loanPrincipalCents).toBe(13_000_000);
    expect(fin.investorCashCents).toBe(0);
  });

  it("100% financing leaves the fees as investor cash", () => {
    const a = A({ financingPct: 100, notaryPct: 7.5, bankFeesCents: 100_000 });
    const acq = computeAcquisitionCost(price, a);
    const fin = computeFinancing(acq, a);
    expect(fin.loanPrincipalCents).toBe(price); // €120,000
    expect(fin.investorCashCents).toBe(1_000_000); // €10,000 of fees
  });

  it("honours an explicit down payment", () => {
    const a = A({ downPaymentCents: 2_000_000 }); // €20,000
    const acq = computeAcquisitionCost(price, a);
    const fin = computeFinancing(acq, a);
    expect(fin.investorCashCents).toBe(2_000_000);
    expect(fin.loanPrincipalCents).toBe(acq.totalInvestmentCents - 2_000_000);
  });
});

describe("computeYields", () => {
  it("returns null cash-on-cash when investor cash is zero", () => {
    const y = computeYields({
      rentMonthlyCents: 95_000,
      priceCents: 12_000_000,
      totalInvestmentCents: 13_000_000,
      noiAnnualCents: 800_000,
      monthlyCashFlowCents: 4_000,
      investorCashCents: 0,
    });
    expect(y.cashOnCashPct).toBeNull();
    expect(y.grossYieldPct).toBeCloseTo(9.5, 5); // €95k×12 / €120k
  });

  it("computes cash-on-cash when investor has skin in the game", () => {
    const y = computeYields({
      rentMonthlyCents: 95_000,
      priceCents: 12_000_000,
      totalInvestmentCents: 13_000_000,
      noiAnnualCents: 800_000,
      monthlyCashFlowCents: 4_000,
      investorCashCents: 1_000_000,
    });
    // €48,000 annual CF / €10,000 cash = 4.8%
    expect(y.cashOnCashPct).toBeCloseTo(4.8, 5);
  });
});

describe("classifyDscr", () => {
  it("assigns the PRD bands", () => {
    expect(classifyDscr(0.9)).toBe("NEGATIVE");
    expect(classifyDscr(1.05)).toBe("FRAGILE");
    expect(classifyDscr(1.15)).toBe("ACCEPTABLE");
    expect(classifyDscr(1.25)).toBe("STRONG");
    expect(classifyDscr(1.4)).toBe("EXCELLENT");
  });
});

describe("classifyWhiteOperation", () => {
  it("NOT_WHITE when cash flow negative", () => {
    expect(
      classifyWhiteOperation({ monthlyCashFlowCents: -1, dscr: 2, grossYieldPct: 12, rentalDemandScore: 90 })
    ).toBe("NOT_WHITE");
  });
  it("FULL when cash flow just non-negative but weak DSCR", () => {
    expect(
      classifyWhiteOperation({ monthlyCashFlowCents: 4_000, dscr: 1.05, grossYieldPct: 9.5, rentalDemandScore: 60 })
    ).toBe("FULL");
  });
  it("STRONG when cash flow ≥ €100 and DSCR ≥ 1.20", () => {
    expect(
      classifyWhiteOperation({ monthlyCashFlowCents: 12_000, dscr: 1.22, grossYieldPct: 8, rentalDemandScore: 60 })
    ).toBe("STRONG");
  });
  it("EXCELLENT only when all four gates pass", () => {
    expect(
      classifyWhiteOperation({ monthlyCashFlowCents: 22_000, dscr: 1.3, grossYieldPct: 9.5, rentalDemandScore: 75 })
    ).toBe("EXCELLENT");
    // fails demand gate → falls back to STRONG
    expect(
      classifyWhiteOperation({ monthlyCashFlowCents: 22_000, dscr: 1.3, grossYieldPct: 9.5, rentalDemandScore: 50 })
    ).toBe("STRONG");
  });
});

describe("computeCashFlow", () => {
  it("subtracts every operating line and the mortgage", () => {
    const a = A({ vacancyPct: 5, maintenancePct: 5, managementPct: 0 });
    const op: OperatingInputs = {
      nonRecoverableCoproMonthlyCents: 5_000,
      taxeFonciereAnnualCents: 80_000,
      landlordInsuranceAnnualCents: 12_000,
    };
    const mortgage = computeMortgage(13_000_000, a);
    const cf = computeCashFlow(95_000, mortgage, op, a);
    const eb = cf.expenseBreakdown;
    expect(eb.maintenanceReserveCents).toBe(4_750); // 5% of €950
    expect(eb.vacancyReserveCents).toBe(4_750);
    expect(eb.taxeFonciereMonthlyCents).toBe(6_667); // €800/12 rounded
    expect(cf.operatingExpensesMonthlyCents).toBe(
      5_000 + 6_667 + 1_000 + 4_750 + 4_750 + 0 + 0
    );
    expect(cf.monthlyCashFlowCents).toBe(
      95_000 - mortgage.monthlyTotalCents - cf.operatingExpensesMonthlyCents
    );
    // NOI excludes financing
    expect(cf.noiAnnualCents).toBe((95_000 - cf.operatingExpensesMonthlyCents) * 12);
  });
});

const RENT: RentEstimate = {
  conservativeCents: 90_000,
  marketCents: 95_000,
  optimisticCents: 100_000,
};
const OP: OperatingInputs = {
  nonRecoverableCoproMonthlyCents: 5_000,
  taxeFonciereAnnualCents: 80_000,
  landlordInsuranceAnnualCents: 12_000,
};

describe("analyzeProperty — opération blanche golden case", () => {
  const analysis = analyzeProperty(
    { priceCents: 12_000_000, rent: RENT, operating: OP, rentalDemandScore: 65 },
    A()
  );

  it("is fully financed with €0 investor cash", () => {
    expect(analysis.financing.investorCashCents).toBe(0);
    expect(analysis.yields.cashOnCashPct).toBeNull();
  });

  it("produces a positive cash flow (FULL WHITE)", () => {
    expect(analysis.cashFlow.monthlyCashFlowCents).toBeGreaterThan(0);
    expect(analysis.whiteStatus).toBe("FULL");
  });

  it("reports a ~9.5% gross yield", () => {
    expect(analysis.yields.grossYieldPct).toBeCloseTo(9.5, 1);
  });

  it("uses market rent by default, conservative when asked", () => {
    const conservative = analyzeProperty(
      { priceCents: 12_000_000, rent: RENT, operating: OP },
      A({ rentScenario: "CONSERVATIVE" })
    );
    expect(conservative.cashFlow.rentCents).toBe(90_000);
    expect(analysis.cashFlow.rentCents).toBe(95_000);
  });
});

describe("computeBreakEven", () => {
  const analysis = analyzeProperty(
    { priceCents: 12_000_000, rent: RENT, operating: OP, rentalDemandScore: 65 },
    A()
  );

  it("full-white break-even is at or above a price that still cash-flows", () => {
    const be = analysis.breakEven.fullWhiteMaxPriceCents!;
    expect(be).toBeGreaterThan(12_000_000); // asking already cash-flows positive
    // at the break-even price, cash flow should be ~0 (within €1/mo)
    const atBe = analyzeProperty(
      { priceCents: be, rent: RENT, operating: OP, rentalDemandScore: 65 },
      A()
    );
    expect(Math.abs(atBe.cashFlow.monthlyCashFlowCents)).toBeLessThan(100);
  });

  it("full-white max price ≥ strong-white max price", () => {
    expect(analysis.breakEven.fullWhiteMaxPriceCents!).toBeGreaterThanOrEqual(
      analysis.breakEven.strongWhiteMaxPriceCents!
    );
  });

  it("returns null when a property can never be white", () => {
    const hopeless = analyzeProperty(
      {
        priceCents: 30_000_000,
        rent: { conservativeCents: 10_000, marketCents: 10_000, optimisticCents: 10_000 },
        operating: {
          nonRecoverableCoproMonthlyCents: 20_000, // costs alone exceed rent
          taxeFonciereAnnualCents: 200_000,
          landlordInsuranceAnnualCents: 0,
        },
      },
      A()
    );
    expect(hopeless.breakEven.fullWhiteMaxPriceCents).toBeNull();
  });
});

describe("computeNegotiationScenarios", () => {
  it("cash flow improves as the price drops", () => {
    const scenarios = computeNegotiationScenarios(
      { priceCents: 15_000_000, rent: RENT, operating: OP, rentalDemandScore: 65 },
      A()
    );
    expect(scenarios.map((s) => s.discountPct)).toEqual([0, 5, 10, 15]);
    for (let i = 1; i < scenarios.length; i++) {
      expect(scenarios[i].monthlyCashFlowCents).toBeGreaterThan(
        scenarios[i - 1].monthlyCashFlowCents
      );
      expect(scenarios[i].priceCents).toBeLessThan(scenarios[i - 1].priceCents);
    }
  });
});
