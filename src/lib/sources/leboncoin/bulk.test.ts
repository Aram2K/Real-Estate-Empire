import { describe, expect, it } from "vitest";
import { createCommuneResolver, parseLeboncoinCard, parseSellerBadge } from "./bulk";

describe("Leboncoin bulk cards", () => {
  it("parses a canonical card and strips tracking from the URL", () => {
    expect(parseLeboncoinCard({
      url: "https://www.leboncoin.fr/ad/ventes_immobilieres/3219139353?foo=bar",
      text: "Prix: 273 000 €\nAppartement · 2 pièces · 45,5 m²\nSituée à Rouen 76000.",
      dpe: "Classe énergie D",
    })).toMatchObject({ externalId: "3219139353", price: 27_300_000, surface: 45.5, postalCode: "76000", dpe: "D" });
  });

  it("maps Paris postcodes to arrondissement INSEE codes", () => {
    const resolve = createCommuneResolver([{ code: "75106", nom: "Paris 6e Arrondissement", departement: "75" }]);
    expect(resolve("Paris", "75006")?.code).toBe("75106");
  });

  it("does not guess when a fuzzy label is ambiguous", () => {
    const resolve = createCommuneResolver([
      { code: "77001", nom: "Saint-Pierre", departement: "77" },
      { code: "77002", nom: "Saint-Pierre-du-Perray", departement: "77" },
    ]);
    expect(resolve("Saint-Pierre-du", "77000")).toBeUndefined();
  });
});

describe("parseSellerBadge", () => {
  const card = (badge: string) =>
    `${badge}
Prix: 273 000 EUR
Appartement - 2 pieces - 45,5 m2
Situee a Saint-Maur-des-Fosses 94100.`;

  it("reads a Particulier badge as a private seller", () => {
    expect(parseSellerBadge(card("Particulier"))).toBe("INDIVIDUAL");
    expect(parseSellerBadge("Appartement | Particulier | 45 m2")).toBe("INDIVIDUAL");
  });

  it("reads professional badge variants as agency", () => {
    for (const b of ["Pro", "Professionnel", "Boutique", "Agence"]) {
      expect(parseSellerBadge(card(b))).toBe("AGENCY");
    }
  });

  it("returns UNKNOWN when the capture carries no badge", () => {
    // This is the current bulk-import payload shape. It must never be read as
    // professional -- doing so would mislabel every Leboncoin listing.
    expect(parseSellerBadge(card(""))).toBe("UNKNOWN");
  });

  it("does not match a badge word embedded in a longer word", () => {
    expect(parseSellerBadge("Propriete de prestige, promotion neuve")).toBe("UNKNOWN");
  });

  it("prefers the private badge over agency marketing copy", () => {
    expect(parseSellerBadge("Particulier - vente directe, sans agence")).toBe("INDIVIDUAL");
  });

  it("is accent and case insensitive", () => {
    expect(parseSellerBadge("PARTICULIER")).toBe("INDIVIDUAL");
    expect(parseSellerBadge("Professionnél")).toBe("AGENCY");
  });
});
