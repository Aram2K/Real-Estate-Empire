import { describe, expect, it } from "vitest";
import {
  HarvestRowSchema,
  dpeOf,
  harvestTimestamp,
  parsePipeRow,
  propertyTypeOf,
  sellerTypeOf,
} from "./harvest";

describe("sellerTypeOf", () => {
  it("maps the advertiser kind the payload states", () => {
    expect(sellerTypeOf("pro")).toBe("AGENCY");
    expect(sellerTypeOf("private")).toBe("INDIVIDUAL");
    expect(sellerTypeOf("PRO")).toBe("AGENCY");
  });

  it("never guesses when the payload says nothing it recognises", () => {
    for (const v of [null, undefined, "", "unknown", "shop"]) {
      expect(sellerTypeOf(v)).toBe("UNKNOWN");
    }
  });
});

describe("propertyTypeOf", () => {
  it("maps the two dwelling types", () => {
    expect(propertyTypeOf("1")).toBe("Maison");
    expect(propertyTypeOf("2")).toBe("Appartement");
  });

  it("returns null for land, parking and other non-dwellings", () => {
    // Codes 3/4/5 are plots, parking and commercial — they share the sale
    // category but must never be analysed as rental dwellings.
    for (const v of ["3", "4", "5", null, undefined]) {
      expect(propertyTypeOf(v)).toBeNull();
    }
  });
});

describe("dpeOf", () => {
  it("normalises a stated energy class", () => {
    expect(dpeOf("f")).toBe("F");
    expect(dpeOf("A")).toBe("A");
  });

  it("rejects anything that is not a real class", () => {
    for (const v of ["v", "", null, undefined, "vierge", "1"]) {
      expect(dpeOf(v)).toBeNull();
    }
  });
});

describe("harvestTimestamp", () => {
  it("orders source timestamps newest first and puts missing dates last", () => {
    const rows = [
      { publishedAt: null },
      { publishedAt: "2026-09-18 10:00:00" },
      { publishedAt: "2026-09-20T08:00:00+02:00" },
    ].sort((a, b) => harvestTimestamp(b.publishedAt) - harvestTimestamp(a.publishedAt));
    expect(rows.map((row) => row.publishedAt)).toEqual([
      "2026-09-20T08:00:00+02:00",
      "2026-09-18 10:00:00",
      null,
    ]);
  });
});

describe("parsePipeRow", () => {
  const row =
    "3263154228|pro|88500000|Paris|75018|48.88582|2.33506|2|71|3|g|active";

  it("reads every field in the extractor's order", () => {
    const r = parsePipeRow(row);
    expect(r).toMatchObject({
      id: "3263154228",
      ownerType: "pro",
      priceCents: 88_500_000,
      city: "Paris",
      zipcode: "75018",
      lat: 48.88582,
      lng: 2.33506,
      realEstateType: "2",
      square: 71,
      rooms: 3,
      energy: "g",
      status: "active",
    });
    expect(r.url).toBe("https://www.leboncoin.fr/ad/ventes_immobilieres/3263154228");
  });

  it("treats empty fields as not stated rather than zero", () => {
    const r = parsePipeRow("3090390090|pro|54000000|Paris|75016|||2|34|2|d|active");
    expect(r.lat).toBeNull();
    expect(r.lng).toBeNull();
    // No coordinates means no street-number claim, so nothing can be treated
    // as a precise position.
    expect(r.originType).toBeNull();
  });

  it("marks a coordinate pair as street-number precise", () => {
    expect(parsePipeRow(row).originType).toBe("streetNumber");
  });
});

describe("HarvestRowSchema", () => {
  it("accepts a pipe row and a full object alike", () => {
    const fromPipe = HarvestRowSchema.parse(
      "3263154228|pro|88500000|Paris|75018|||2|71|3|g|active"
    );
    expect(fromPipe.id).toBe("3263154228");

    const fromObject = HarvestRowSchema.parse({
      id: 3263154228,
      ownerType: "private",
      priceCents: 100,
      square: 40,
      rooms: 2,
    });
    expect(fromObject.id).toBe("3263154228");
    expect(fromObject.ownerType).toBe("private");
  });

  it("rejects a row whose room count is implausible", () => {
    // One malformed advert must fail on its own; the caller drops it and keeps
    // the rest of the page.
    const bad = HarvestRowSchema.safeParse(
      "3263154228|pro|88500000|Paris|75018|||2|71|999|g|active"
    );
    expect(bad.success).toBe(false);
  });
});
