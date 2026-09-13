import { describe, expect, it } from "vitest";
import { reviewGdcSource, reviewedIdsFromJsonl } from "./review";

const base = { externalId: "abc-123", url: "https://gensdeconfiance.com/us/ui/post/realestate__sale/abc-123?search=x" };

describe("GDC source review", () => {
  it("keeps an ordinary whole-property sale and stores source prose", () => {
    const review = reviewGdcSource({ ...base, sourceTitle: "Appartement familial", sourceDescription: "Appartement 4 pièces avec cave et parking.", reviewedAt: new Date("2026-09-13T10:00:00Z") });
    expect(review).toMatchObject({ outcome: "KEEP", reasons: [], sourceTitle: "Appartement familial" });
  });

  it.each([
    ["Appartement en viager", "Bouquet et rente mensuelle", "NON_WHOLE_PROPERTY"],
    ["Nue-propriété à Paris", "Usufruit conservé", "NON_WHOLE_PROPERTY"],
    ["Parking Paris 15", "Place de stationnement", "ANCILLARY_SPACE_ONLY"],
  ])("quarantines only explicit source evidence: %s", (sourceTitle, sourceDescription, reason) => {
    const review = reviewGdcSource({ ...base, sourceTitle, sourceDescription });
    expect(review.outcome).toBe("QUARANTINE");
    expect(review.reasons).toContain(reason);
  });

  it("rejects mismatched source identity and incomplete evidence", () => {
    expect(() => reviewGdcSource({ ...base, externalId: "different", sourceTitle: "Appartement", sourceDescription: "Normal sale" })).toThrow(/match/);
    expect(() => reviewGdcSource({ ...base, sourceTitle: "Appartement", sourceDescription: "" })).toThrow(/required/);
  });

  it("recovers reviewed IDs from a partially written checkpoint", () => {
    expect([...reviewedIdsFromJsonl('{"externalId":"A"}\ntruncated{\n{"externalId":"b"}\n')]).toEqual(["a", "b"]);
  });
});
