import { describe, expect, it } from "vitest";
import { isGensDeConfianceCard, parseGensDeConfianceCard, parsePublishedAt } from "./bulk";

describe("Gens de Confiance bulk cards", () => {
  it("parses the current English visible-card format", () => {
    const parsed = parseGensDeConfianceCard({
      url: "https://gensdeconfiance.com/us/ui/post/realestate__sale/ABC-123?from=search",
      text: "€ 425,000\nApartment · 51.5 m² · 3 rooms\nBoulogne-Billancourt\n(92100)\nDPE C",
    });
    expect(parsed).toMatchObject({ externalId: "abc-123", price: 42_500_000, propertyType: "Appartement", rooms: 3, surface: 51.5, city: "Boulogne-Billancourt", postalCode: "92100", dpe: "C" });
    expect(parsed?.url).not.toContain("?");
  });

  it("captures exact and approximate source publication times", () => {
    const observed = new Date("2026-09-12T12:00:00+02:00");
    expect(parsePublishedAt("2026-09-10T08:15:00+02:00", "", observed)?.toISOString()).toBe("2026-09-10T06:15:00.000Z");
    expect(parsePublishedAt(undefined, "Publiée il y a 3 heures", observed)?.toISOString()).toBe("2026-09-12T07:00:00.000Z");
    expect(parsePublishedAt(undefined, "Publiée hier à 09h30", observed)?.toISOString()).toBe("2026-09-11T07:30:00.000Z");
  });

  it("accepts structured browser extraction and an explicit seller", () => {
    const parsed = parseGensDeConfianceCard({
      url: "https://www.gensdeconfiance.com/us/ui/post/realestate__sale/a7f1",
      price: 610000,
      propertyType: "Maison",
      rooms: 6,
      surface: 132,
      city: "Versailles",
      postalCode: "78000",
      sellerType: "INDIVIDUAL",
      sellerName: "Owner",
    });
    expect(parsed).toMatchObject({ price: 61_000_000, propertyType: "Maison", rooms: 6, surface: 132, sellerType: "INDIVIDUAL", sellerName: "Owner" });
  });

  it("rejects incomplete, non-IDF and foreign-source records", () => {
    expect(parseGensDeConfianceCard({ url: "https://gensdeconfiance.com/us/ui/post/realestate__sale/x", text: "House · 80 m² · 4 rooms\nLyon (69000)\n€300000" })).toBeNull();
    expect(parseGensDeConfianceCard({ url: "https://example.com/us/ui/post/realestate__sale/x", price: 1, propertyType: "House", rooms: 1, surface: 1, city: "Paris", postalCode: "75001" })).toBeNull();
    expect(isGensDeConfianceCard({ url: "https://gensdeconfiance.com/us/ui/post/realestate__sale/x" })).toBe(true);
  });
});
