/**
 * Deep links to the major French portals' own search pages for a commune, so
 * the user can find comparable REAL listings and contact sellers there. These
 * are convenience links to public search — no scraping. We route via a scoped
 * web search because each portal uses its own city-id/slug scheme that isn't
 * safe to hand-construct.
 */
export interface PortalLink {
  label: string;
  url: string;
}

export function portalSearchLinks(opts: {
  commune: string;
  departement?: string | null;
  propertyType?: string | null;
}): PortalLink[] {
  const type = opts.propertyType === "Maison" ? "maison" : "appartement";
  const base = `achat ${type} ${opts.commune}${
    opts.departement ? " " + opts.departement : ""
  }`;
  const g = (site?: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(
      base + (site ? ` site:${site}` : "")
    )}`;

  return [
    { label: "Leboncoin", url: g("leboncoin.fr") },
    { label: "SeLoger", url: g("seloger.com") },
    { label: "Bien'ici", url: g("bienici.com") },
    { label: "PAP", url: g("pap.fr") },
    { label: "Gens de Confiance", url: g("gensdeconfiance.com") },
    { label: "All portals", url: g() },
  ];
}
