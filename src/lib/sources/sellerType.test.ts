import { describe, expect, it } from "vitest";
import { classifySeller, hostOf, isMixedPortal } from "./sellerType";

describe("classifySeller", () => {
  it("labels agency-network domains from the URL alone", () => {
    for (const url of [
      "https://www.century21.fr/trouver_logement/detail/15663673158/",
      "https://www.laforet.com/annonce/123",
      "https://www.orpi.com/annonce/456",
      "https://www.iadfrance.fr/annonce/789",
    ]) {
      expect(classifySeller({ url }).type).toBe("AGENCY");
    }
  });

  it("labels particulier-only portals as individual", () => {
    expect(classifySeller({ url: "https://www.pap.fr/annonce/vente-123" }).type).toBe("INDIVIDUAL");
    expect(classifySeller({ url: "https://gensdeconfiance.com/us/ui/post/realestate__sale/abc" }).type).toBe("INDIVIDUAL");
  });

  it("does not guess on a mixed portal with no seller signal", () => {
    const r = classifySeller({
      url: "https://www.leboncoin.fr/ad/ventes_immobilieres/3263444877",
      text: "Public listing reviewed on 2026-09-07. Availability is not confirmed.",
    });
    expect(r.type).toBe("UNKNOWN");
  });

  it("reads the advertiser out of the reviewed-note convention", () => {
    const r = classifySeller({
      url: "https://www.leboncoin.fr/ad/ventes_immobilieres/3263444877",
      text: "Leboncoin / Expertimo Nadia Lagraf. La Haie Bertrand, garage and garden.",
    });
    expect(r.type).toBe("AGENCY");
    expect(r.name).toBe("Expertimo Nadia Lagraf");
  });

  it("recognises a mandataire network named without the word agence", () => {
    const r = classifySeller({
      url: "https://www.leboncoin.fr/ad/ventes_immobilieres/1",
      text: "Leboncoin / iad Sandrine Lhuillier. Maison de ville.",
    });
    expect(r.type).toBe("AGENCY");
  });

  it("treats an explicit particulier badge as a private sale", () => {
    const r = classifySeller({
      url: "https://www.leboncoin.fr/ad/ventes_immobilieres/2",
      text: "Particulier · Appartement · 3 pièces · 64 m²",
    });
    expect(r.type).toBe("INDIVIDUAL");
  });

  it("lets the source state the answer outright", () => {
    expect(classifySeller({ url: "https://www.leboncoin.fr/ad/ventes_immobilieres/3", explicit: "INDIVIDUAL" }).type).toBe("INDIVIDUAL");
    expect(classifySeller({ url: "https://www.pap.fr/annonce/1", explicit: "AGENCY" }).type).toBe("AGENCY");
  });

  it("survives a malformed URL", () => {
    expect(hostOf("not a url")).toBeNull();
    expect(classifySeller({ url: "not a url" }).type).toBe("UNKNOWN");
  });

  it("knows which portals are mixed", () => {
    expect(isMixedPortal("https://www.leboncoin.fr/ad/ventes_immobilieres/1")).toBe(true);
    expect(isMixedPortal("https://www.century21.fr/x")).toBe(false);
  });
});

describe("import boilerplate", () => {
  it("never reads the app's own 'professional-sale' boilerplate as evidence", () => {
    // This exact sentence is written unconditionally by the Leboncoin bulk
    // importer. Treating it as a signal would label all ~2,700 Leboncoin
    // listings AGENCY on the strength of our own assumption.
    const r = classifySeller({
      url: "https://www.leboncoin.fr/ad/ventes_immobilieres/3263444877",
      text: "Public professional-sale result observed on Leboncoin. Availability and the exact address must be confirmed with the advertiser.",
    });
    expect(r.type).toBe("UNKNOWN");
  });

  it("still reads a genuine reviewer note through the boilerplate", () => {
    const r = classifySeller({
      url: "https://www.leboncoin.fr/ad/ventes_immobilieres/1",
      text: "Public listing on www.leboncoin.fr reviewed on 2026-09-07. Availability is not confirmed with the advertiser.\n\nLeboncoin / CIEL IMMO. Garage and garden.",
    });
    expect(r.type).toBe("AGENCY");
    expect(r.name).toBe("CIEL IMMO");
  });
});
