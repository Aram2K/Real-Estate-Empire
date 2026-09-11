import { describe, expect, it } from "vitest";
import { groupMapListings } from "./mapListings";
import type { PropertyListItem } from "@/lib/properties/query";

const listing = (id: string, overrides = {}) => ({ id, communeCode: "94028", lat: null, lon: null, communeLat: 48.79, communeLon: 2.46, ...overrides } as PropertyListItem);

describe("map listing coverage", () => {
  it("keeps every town-only listing accessible in one group without changing exact coordinates", () => {
    const items = [listing("a"), listing("b"), listing("c", { lat: 48.8, lon: 2.45 })];
    const result = groupMapListings(items);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].items.map((x) => x.id)).toEqual(["a", "b"]);
    expect(result.groups[0].approximate).toBe(true);
    expect(result.groups[1]).toMatchObject({ approximate: false, lat: 48.8, lon: 2.45 });
    expect(items[0].lat).toBeNull();
  });
  it("retains unlocatable listings for the fallback list and groups coincident exact points", () => {
    const result = groupMapListings([listing("a", { communeLat: null }), listing("b", { lat: 48.8, lon: 2.4 }), listing("c", { lat: 48.8, lon: 2.4 })]);
    expect(result.unlocated.map((x) => x.id)).toEqual(["a"]);
    expect(result.groups[0].items).toHaveLength(2);
  });
});
