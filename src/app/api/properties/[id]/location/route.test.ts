import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), geocode: vi.fn(), analyze: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { property: { findUnique: mocks.find, update: mocks.update } } }));
vi.mock("@/lib/geo/geocode", () => ({ geocodeAddress: mocks.geocode }));
vi.mock("@/lib/properties/analyzeOne", () => ({ computeAndStoreAnalysis: mocks.analyze }));
import { PATCH } from "./route";
const run = () => PATCH(new NextRequest("http://localhost/api/properties/p/location", { method: "PATCH", body: JSON.stringify({ address: "12 rue de Paris, Créteil" }) }), { params: Promise.resolve({ id: "p" }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.find.mockResolvedValue({ codeCommune: "94028", isDemo: false });
  mocks.geocode.mockResolvedValue({ lat: 48.79, lon: 2.46, codeCommune: "94028", type: "housenumber", score: 0.95, label: "12 rue de Paris" });
  mocks.analyze.mockResolvedValue(true);
});
it("rejects town-only geocoding without replacing the property location", async () => {
  mocks.geocode.mockResolvedValue({ type: "municipality", score: 1, codeCommune: "94028" });
  expect((await run()).status).toBe(422);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("rejects a street address in a different town", async () => {
  mocks.geocode.mockResolvedValue({ type: "housenumber", score: 0.95, codeCommune: "75056" });
  expect((await run()).status).toBe(422);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("stores a matched street-number location and recalculates transport analysis", async () => {
  expect((await run()).status).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: "p" }, data: { lat: 48.79, lon: 2.46, addressLine: "12 rue de Paris" } });
  expect(mocks.analyze).toHaveBeenCalledWith("p");
});
