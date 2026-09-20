import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  geocode: vi.fn(), analyze: vi.fn(),
  db: {
    commune: { findUnique: vi.fn() },
    propertySource: { upsert: vi.fn() },
    property: { upsert: vi.fn() },
    listing: { findUnique: vi.fn(), upsert: vi.fn() },
    priceHistory: { create: vi.fn() },
    savedProperty: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/lib/geo/geocode", () => ({ geocodeAddress: mocks.geocode }));
vi.mock("@/lib/properties/analyzeOne", () => ({ computeAndStoreAnalysis: mocks.analyze }));
import { POST } from "./route";

const input = { address: "12 rue de la République, Rouen", priceEuros: 149500, surface: 32, dpe: "D" };
function request(body = input) {
  return new NextRequest("http://localhost/api/properties", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.geocode.mockResolvedValue({ lat: 49.443, lon: 1.099, codeCommune: "76540", label: input.address });
  mocks.db.commune.findUnique.mockResolvedValue({ code: "76540" });
  mocks.db.propertySource.upsert.mockResolvedValue({ id: "manual" });
  mocks.db.property.upsert.mockResolvedValue({ id: "property" });
  mocks.db.listing.upsert.mockResolvedValue({ id: "listing" });
  mocks.db.listing.findUnique.mockResolvedValue(null);
  mocks.analyze.mockResolvedValue(true);
});

describe("manual listing import", () => {
  it("analyzes, records the initial price and saves the property", async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(mocks.analyze).toHaveBeenCalledWith("property");
    expect(mocks.db.priceHistory.create).toHaveBeenCalledWith({ data: { listingId: "listing", price: 14950000 } });
    expect(mocks.db.savedProperty.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ propertyId: "property" }) }));
  });
  it("does not duplicate price observations for unchanged imports", async () => {
    mocks.db.listing.findUnique.mockResolvedValue({ price: 14950000 });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.db.priceHistory.create).not.toHaveBeenCalled();
  });
  it("records changed asking prices", async () => {
    mocks.db.listing.findUnique.mockResolvedValue({ price: 16000000 });
    await POST(request());
    expect(mocks.db.priceHistory.create).toHaveBeenCalledOnce();
  });
  it("rejects invalid DPE values before using external services", async () => {
    expect((await POST(request({ ...input, dpe: "Z" }))).status).toBe(400);
    expect(mocks.geocode).not.toHaveBeenCalled();
  });
  it("reports geocoding outages as retryable service failures", async () => {
    mocks.geocode.mockRejectedValue(new Error("timeout"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.db.property.upsert).not.toHaveBeenCalled();
  });
  it("rejects addresses outside the active collection area before writing", async () => {
    mocks.geocode.mockResolvedValue({ lat: 45.76, lon: 4.83, codeCommune: "69123" });
    expect((await POST(request())).status).toBe(422);
    expect(mocks.db.property.upsert).not.toHaveBeenCalled();
  });
  it("accepts Rouen when its market coverage is loaded", async () => {
    mocks.geocode.mockResolvedValue({ lat: 49.443, lon: 1.099, codeCommune: "76540", label: "Rouen" });
    mocks.db.commune.findUnique.mockResolvedValue({ code: "76540" });
    expect((await POST(request({ ...input, address: "Rouen" }))).status).toBe(200);
  });
  it("rejects new Paris imports", async () => {
    mocks.geocode.mockResolvedValue({ lat: 48.86, lon: 2.35, codeCommune: "75101", label: "Paris" });
    expect((await POST(request({ ...input, address: "Paris" }))).status).toBe(422);
    expect(mocks.db.property.upsert).not.toHaveBeenCalled();
  });
  it("reports missing commune coverage without a foreign-key failure", async () => {
    mocks.db.commune.findUnique.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(422);
    expect(mocks.db.property.upsert).not.toHaveBeenCalled();
  });
  it("does not report success when analysis could not be computed", async () => {
    mocks.analyze.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(422);
    expect(mocks.db.savedProperty.upsert).not.toHaveBeenCalled();
  });
});
