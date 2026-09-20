import { describe, expect, it } from "vitest";
import { isGensDeConfianceCard, nonWholePropertyReason, parseGensDeConfianceCard, parsePublishedAt } from "./bulk";

describe("Gens de Confiance bulk cards", () => {
  it("parses the current English visible-card format", () => {
    const parsed = parseGensDeConfianceCard({
      url: "https://gensdeconfiance.com/us/ui/post/realestate__sale/ABC-123?from=search",
      text: "€ 425,000\nApartment · 51.5 m² · 3 rooms\nRouen\n(76000)\nDPE C",
    });
    expect(parsed).toMatchObject({ externalId: "abc-123", price: 42_500_000, propertyType: "Appartement", rooms: 3, surface: 51.5, city: "Rouen", postalCode: "76000", dpe: "C" });
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
      propertyType: "Appartement",
      rooms: 4,
      surface: 92,
      city: "Orléans",
      postalCode: "45000",
      sellerType: "INDIVIDUAL",
      sellerName: "Owner",
    });
    expect(parsed).toMatchObject({ price: 61_000_000, propertyType: "Appartement", rooms: 4, surface: 92, sellerType: "INDIVIDUAL", sellerName: "Owner" });
  });

  it("rejects houses and Paris even when the card is otherwise complete", () => {
    const base = {
      url: "https://gensdeconfiance.com/us/ui/post/realestate__sale/scope",
      price: 300_000,
      rooms: 3,
      surface: 70,
    };
    expect(parseGensDeConfianceCard({ ...base, propertyType: "House", city: "Rouen", postalCode: "76000" })).toBeNull();
    expect(parseGensDeConfianceCard({ ...base, propertyType: "Apartment", city: "Paris", postalCode: "75015" })).toBeNull();
  });

  it("rejects incomplete, non-IDF and foreign-source records", () => {
    expect(parseGensDeConfianceCard({ url: "https://gensdeconfiance.com/us/ui/post/realestate__sale/x", text: "House · 80 m² · 4 rooms\nLyon (69000)\n€300000" })).toBeNull();
    expect(parseGensDeConfianceCard({ url: "https://example.com/us/ui/post/realestate__sale/x", price: 1, propertyType: "House", rooms: 1, surface: 1, city: "Paris", postalCode: "75001" })).toBeNull();
    expect(isGensDeConfianceCard({ url: "https://gensdeconfiance.com/us/ui/post/realestate__sale/x" })).toBe(true);
  });

  it.each([
    ["Appartement en viager occupé", "Bouquet 90 000 € et rente mensuelle"],
    ["Studio en nue-propriété", "Appartement · 20 m² · 1 pièce"],
    ["Multipropriété à Paris", "Droit de séjour 2 semaines par an"],
    ["Vente d'une quote-part", "Propriété fractionnée"],
    ["Parking Paris 15e", "Appartement · 12 m² · 1 pièce"],
    ["Cave dans immeuble", "Appartement · 8 m² · 1 pièce"],
  ])("rejects non-whole-property offer: %s", (title, description) => {
    expect(nonWholePropertyReason(title, description)).not.toBeNull();
    expect(parseGensDeConfianceCard({
      url: `https://gensdeconfiance.com/us/ui/post/realestate__sale/${encodeURIComponent(title)}`,
      title,
      text: `250 000 €\nAppartement · 30 m² · 2 pièces\nParis 75015\n${description}`,
    })).toBeNull();
  });

  it("does not reject a whole apartment merely because it includes a cellar or parking", () => {
    expect(nonWholePropertyReason("Appartement familial", "Appartement vendu avec cave et place de parking incluses")).toBeNull();
  });

  it("rejects numeric signatures that cannot credibly be a whole IDF dwelling", () => {
    const base = {
      url: "https://gensdeconfiance.com/us/ui/post/realestate__sale/numeric-outlier",
      propertyType: "Appartement",
      rooms: 1,
      city: "Rouen",
      postalCode: "76000",
    };
    expect(parseGensDeConfianceCard({ ...base, price: 100_000, surface: 4.5 })).toBeNull();
    expect(parseGensDeConfianceCard({ ...base, price: 9_000, surface: 100 })).toBeNull();
    expect(parseGensDeConfianceCard({ ...base, price: 29_000, surface: 100 })).not.toBeNull();
  });
});
