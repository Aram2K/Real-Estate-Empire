import { describe, expect, it } from "vitest";
import { extractLeboncoinNextData } from "./nextData";

describe("extractLeboncoinNextData", () => {
  it("extracts source-stated advert fields without inventing values", () => {
    const [ad] = extractLeboncoinNextData({ props: { pageProps: { searchData: { ads: [{
      list_id: 123,
      url: "https://www.leboncoin.fr/ad/ventes_immobilieres/123",
      price: [245000],
      owner: { type: "private", name: "Alice" },
      subject: "Appartement lumineux Paris 15e",
      body: "Appartement entier avec balcon.",
      images: { urls_large: ["https://img.test/1.jpg", "https://img.test/2.jpg"] },
      location: { city: "Paris", zipcode: "75015", lat: 48.84, lng: 2.29, source: "city" },
      attributes: [
        { key: "real_estate_type", value: "2" },
        { key: "square", value: "41,5" },
        { key: "rooms", value: "2" },
        { key: "energy_rate", value: "D" },
      ],
    }] } } } });

    expect(ad).toMatchObject({
      id: "123", priceCents: 24500000, ownerType: "private", city: "Paris",
      zipcode: "75015", realEstateType: "2", square: 41.5, rooms: 2, energy: "D",
      originType: "city",
      title: "Appartement lumineux Paris 15e",
      description: "Appartement entier avec balcon.",
      photoCount: 2,
    });
  });

  it("ignores entries without an id and tolerates missing nested data", () => {
    expect(extractLeboncoinNextData({})).toEqual([]);
    expect(extractLeboncoinNextData({ props: { pageProps: { searchData: { ads: [{}] } } } })).toEqual([]);
  });
});
