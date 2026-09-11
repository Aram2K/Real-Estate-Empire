import { describe, expect, it } from "vitest";
import { createCommuneResolver, parseLeboncoinCard } from "./bulk";

describe("Leboncoin bulk cards", () => {
  it("parses a canonical card and strips tracking from the URL", () => {
    expect(parseLeboncoinCard({
      url: "https://www.leboncoin.fr/ad/ventes_immobilieres/3219139353?foo=bar",
      text: "Prix: 273 000 €\nAppartement · 2 pièces · 45,5 m²\nSituée à Saint-Maur-des-Fossés 94100.",
      dpe: "Classe énergie D",
    })).toMatchObject({ externalId: "3219139353", price: 27_300_000, surface: 45.5, postalCode: "94100", dpe: "D" });
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
