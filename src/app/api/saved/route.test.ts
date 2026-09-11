import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  properties: vi.fn(),
  db: { savedProperty: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() }, property: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/lib/properties/query", () => ({ getProperties: mocks.properties }));
import { GET, POST, DELETE } from "./route";

beforeEach(() => vi.resetAllMocks());
it("queries only saved property IDs without a global ranking cutoff", async () => {
  mocks.db.savedProperty.findMany.mockResolvedValue([{ propertyId: "low-ranked" }]);
  mocks.properties.mockResolvedValue([{ id: "low-ranked" }]);
  expect((await (await GET()).json()).items).toEqual([{ id: "low-ranked" }]);
  expect(mocks.properties).toHaveBeenCalledWith({ propertyIds: ["low-ranked"], includeDemo: true, limit: 1 });
});
it("rejects invalid IDs without a database write", async () => {
  const res = await POST(new NextRequest("http://localhost/api/saved", { method: "POST", body: JSON.stringify({ propertyId: 123 }) }));
  expect(res.status).toBe(400);
  expect(mocks.db.savedProperty.upsert).not.toHaveBeenCalled();
});
it("returns 404 for a missing property", async () => {
  mocks.db.property.findUnique.mockResolvedValue(null);
  const res = await POST(new NextRequest("http://localhost/api/saved", { method: "POST", body: JSON.stringify({ propertyId: "missing" }) }));
  expect(res.status).toBe(404);
});
it("preserves existing notes when saving without a note", async () => {
  mocks.db.property.findUnique.mockResolvedValue({ id: "property" });
  const res = await POST(new NextRequest("http://localhost/api/saved", { method: "POST", body: JSON.stringify({ propertyId: "property" }) }));
  expect(res.status).toBe(200);
  expect(mocks.db.savedProperty.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
});
it("removing an already absent saved property succeeds", async () => {
  mocks.db.savedProperty.deleteMany.mockResolvedValue({ count: 0 });
  expect((await DELETE(new NextRequest("http://localhost/api/saved?propertyId=missing", { method: "DELETE" }))).status).toBe(200);
});
