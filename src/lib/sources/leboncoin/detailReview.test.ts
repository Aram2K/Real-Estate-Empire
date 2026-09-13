import { describe, expect, it } from "vitest";
import { decideLeboncoinDetail, extractLeboncoinDetail, extractNextDataJson } from "./detailReview";

const payload = (ad: object) => ({ props: { pageProps: { unrelated: { id: "other", subject: "Wrong" }, ad } } });

describe("Leboncoin detail review", () => {
  it("extracts the matching advert and source text from embedded JSON", () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload({ list_id: 42, subject: "Maison", body: "Maison entière", price: [320000], status: "active" }))}</script>`;
    const evidence = extractLeboncoinDetail(extractNextDataJson(html), "42");
    expect(evidence).toEqual({ externalId: "42", title: "Maison", description: "Maison entière", priceCents: 32_000_000, sourceStatus: "active" });
  });

  it("does not accept another advert or incomplete evidence", () => {
    expect(extractLeboncoinDetail(payload({ list_id: 9, subject: "Maison", body: "", price: [1] }), "42")).toBeNull();
    expect(extractLeboncoinDetail(payload({ list_id: 42, subject: "Maison" }), "42")).toBeNull();
    expect(extractNextDataJson("<html>blocked</html>")).toBeNull();
  });

  it("withdraws only explicit inactive or classifier-backed offers", () => {
    expect(decideLeboncoinDetail({ externalId: "1", title: "Appartement", description: "Avec cave", priceCents: 20_000_000, sourceStatus: "active" }, 40).status).toBe("ACTIVE");
    expect(decideLeboncoinDetail({ externalId: "2", title: "Appartement en viager", description: "Bouquet et rente", priceCents: 20_000_000, sourceStatus: "active" }, 40)).toMatchObject({ status: "WITHDRAWN", reasons: ["NON_WHOLE_PROPERTY"] });
    expect(decideLeboncoinDetail({ externalId: "3", title: "Appartement", description: "", priceCents: 20_000_000, sourceStatus: "expired" }, 40).status).toBe("WITHDRAWN");
  });
});
