import { describe, expect, it } from "vitest";
import { parseFilterParams } from "./schema";

describe("property filter parameters", () => {
  it("parses exact room selections and an open-ended room selection", () => {
    const filter = parseFilterParams(new URLSearchParams("rooms=1,3,5&roomsAtLeast=6"));
    expect(filter.roomCounts).toEqual([1, 3, 5]);
    expect(filter.roomsAtLeast).toBe(6);
  });

  it("drops invalid exact room values", () => {
    const filter = parseFilterParams(new URLSearchParams("rooms=2,nope,-1,4.5"));
    expect(filter.roomCounts).toEqual([2]);
  });

  it("parses the strict positive cash-flow switch only when explicitly enabled", () => {
    expect(parseFilterParams(new URLSearchParams("cashFlowPositiveOnly=true")).cashFlowPositiveOnly).toBe(true);
    expect(parseFilterParams(new URLSearchParams("cashFlowPositiveOnly=false")).cashFlowPositiveOnly).toBe(false);
    expect(parseFilterParams(new URLSearchParams()).cashFlowPositiveOnly).toBe(false);
  });
});
