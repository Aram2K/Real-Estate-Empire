import { describe, expect, it } from "vitest";
import { chunkRecords, toJsonLines } from "./exportRecords";

describe("reviewed listing export helpers", () => {
  it("chunks records without dropping or reordering them", () => {
    expect(chunkRecords([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("writes newline-delimited JSON with a final newline", () => {
    expect(toJsonLines([{ id: 1 }, { id: 2 }])).toBe('{"id":1}\n{"id":2}\n');
  });

  it("rejects invalid chunk sizes", () => {
    expect(() => chunkRecords([1], 0)).toThrow("positive integer");
  });
});
