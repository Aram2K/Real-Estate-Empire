import { describe, expect, it } from "vitest";
import { matchesCashFlowFilter } from "./query";

describe("cash-flow property filtering", () => {
  it("keeps only strictly positive monthly cash flow when requested", () => {
    const filter = { cashFlowPositiveOnly: true };

    expect(matchesCashFlowFilter(1, filter)).toBe(true);
    expect(matchesCashFlowFilter(0, filter)).toBe(false);
    expect(matchesCashFlowFilter(-1, filter)).toBe(false);
  });

  it("continues to support an inclusive minimum cash-flow amount", () => {
    const filter = { cashFlowMinCents: 10_000 };

    expect(matchesCashFlowFilter(10_000, filter)).toBe(true);
    expect(matchesCashFlowFilter(9_999, filter)).toBe(false);
  });
});
