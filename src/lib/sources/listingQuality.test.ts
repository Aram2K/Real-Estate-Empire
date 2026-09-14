import { describe, expect, it } from "vitest";
import { classifySuspiciousListing } from "./listingQuality";

const classify = (overrides: Parameters<typeof classifySuspiciousListing>[0]) =>
  classifySuspiciousListing({ priceCents: 250_000_00, surface: 50, propertyType: "Appartement", ...overrides });

describe("classifySuspiciousListing", () => {
  it("excludes houseboats even when advertised as houses", () => {
    expect(classify({ title: "Maison 9 pièces", description: "Cette péniche de type Freycinet est amarrée sur la Seine." }).reasons).toContain("HOUSEBOAT");
    expect(classify({ title: "Houseboat 160 m²" }).reasons).toContain("HOUSEBOAT");
    expect(classify({ title: "Maison", description: "FREYCINET BARGE – 160 SQM" }).reasons).toContain("HOUSEBOAT");
    expect(classify({ title: "Appartement", description: "Vue sur les péniches de la Seine." }).reasons).not.toContain("HOUSEBOAT");
  });
  it.each([
    ["Multipropriété, deux semaines par an", "NON_WHOLE_PROPERTY"],
    ["Vente en viager occupé, bouquet 80 000 €, rente mensuelle", "NON_WHOLE_PROPERTY"],
    ["Nue-propriété appartement Paris", "NON_WHOLE_PROPERTY"],
    ["Vente d'une quote-part indivise", "NON_WHOLE_PROPERTY"],
  ])("rejects explicit non-whole-property offers: %s", (title, reason) => {
    expect(classify({ title }).reasons).toContain(reason);
  });

  it.each(["Parking Paris 15e", "Garage fermé", "Cave de 8 m²", "Lot de box à vendre"])(
    "rejects ancillary-only offers: %s",
    (title) => expect(classify({ title }).reasons).toContain("ANCILLARY_SPACE_ONLY"),
  );

  it("does not reject an apartment merely because it includes parking and a cellar", () => {
    expect(classify({ title: "Appartement 3 pièces", description: "Avec parking, garage et cave." }).suspicious).toBe(false);
  });

  it("excludes dwellings that are sold with an occupant or tenant in place", () => {
    expect(classify({ title: "Appartement vendu occupé", description: "Locataire en place, bail classique." }).reasons).toContain("OCCUPIED_PROPERTY");
    expect(classify({ description: "Vendu loué 560 € / mois hors charges." }).reasons).toContain("OCCUPIED_PROPERTY");
    expect(classify({ title: "LMNP studio", description: "Bail commercial, loyers garantis par le gestionnaire. Le studio ne peut pas être occupé par le propriétaire." }).reasons).toContain("OCCUPIED_PROPERTY");
  });

  it("rejects implausible absolute prices and price per square metre", () => {
    expect(classify({ priceCents: 100_00, surface: 60 }).reasons).toContain("IMPLAUSIBLE_PRICE");
    expect(classify({ priceCents: 5_000_000_00, surface: 20 }).reasons).toContain("IMPLAUSIBLE_PRICE_PER_M2");
  });

  it("rejects surfaces below 5 m² and only combines low price with low €/m²", () => {
    expect(classify({ priceCents: 100_000_00, surface: 4.9 }).reasons).toContain("IMPLAUSIBLE_SURFACE");
    expect(classify({ priceCents: 9_000_00, surface: 100 }).reasons).toContain("IMPLAUSIBLE_PRICE_PER_M2");
    expect(classify({ priceCents: 29_000_00, surface: 100 }).reasons).not.toContain("IMPLAUSIBLE_PRICE_PER_M2");
  });

  it("excludes auction starting prices but keeps an inexpensive direct renovation sale", () => {
    expect(classify({ title: "Vente aux enchères", description: "Mise à prix", priceCents: 5_000_00, surface: 80 }).reasons).toContain("NON_STANDARD_SALE");
    expect(classify({ title: "Maison à rénover", description: "Travaux importants", priceCents: 45_000_00, surface: 100 }).suspicious).toBe(false);
  });

  it("excludes managed LMNP units under a commercial lease", () => {
    expect(classify({
      title: "Studio LMNP",
      description: "Loyer garanti par le gestionnaire sous bail commercial; ne peut pas être occupé à titre personnel.",
    }).reasons).toContain("NON_STANDARD_SALE");
  });

  it("excludes multi-unit programme adverts with starting prices", () => {
    expect(classify({
      title: "Appartement - 3 pièces - Résidence Green Life",
      description: "Appartements neufs du studio au 5 pièces, à partir de 321 500 €; plusieurs biens disponibles.",
    }).reasons).toContain("MULTI_UNIT_PROGRAM");
  });
});
