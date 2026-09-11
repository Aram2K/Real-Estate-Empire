# Public listing review — 5 September 2026

## Update — 7 September 2026

Added 9 browser-reviewed adverts: 4 Gens de Confiance and 5 Leboncoin.
Database total: 32 real properties, including 3 houses and 29 apartments; no demos.
GDC was read using the user's authorized logged-in session. No seller messages
were sent. The Meudon studio with an accepted offer was excluded.
Leboncoin detail pages worked in the browser even though earlier fetch attempts
failed. Two house locations were corrected to the communes explicitly stated in
their descriptions (Bussières and Guérard), with the portal discrepancies noted.
All added adverts have source URLs, dates, factual notes and computed analyses.
Exact addresses remain unconfirmed; map positions use labeled commune centres.
The reviewed importer now retains Maison versus Appartement instead of assuming
every record is an apartment. House-specific financial assumptions need review.
New batches: `2026-09-07-portals.json` and `2026-09-07-leboncoin.json`.

## Initial batch

22 imported adverts, plus one pre-existing real property: 23 non-demo properties.
All 22 reviewed adverts have stored analyses. This is a snapshot, not a continuous feed.

| Source | Imported | Locations |
|---|---:|---|
| Century 21 | 8 | Melun, Évry-Courcouronnes |
| Laforêt | 4 | Livry-Gargan |
| iad | 3 | Argenteuil |
| SAFTI | 1 | Mantes-la-Jolie |
| PAP | 2 | Paris 14th and 20th |
| Capifrance | 1 | Nanterre |
| Orpi | 3 | Créteil |

Together these cover departments 75, 77, 78, 91, 92, 93, 94 and 95.
Source URLs, observation dates, facts and uncertainties are in the JSON batches.
Unknown addresses are not geocoded to fabricated exact positions. DPE, taxes and
charges remain missing where not verified. Availability requires advertiser confirmation.
URL identity prevents repeated imports; cross-publisher duplicates still require review.

## Other sources checked

- Nestenn: tested Vitry detail pages redirected or explicitly said unavailable; excluded.
- Stéphane Plaza: Créteil search title advertised results but live browser showed none.
- SeLoger: tested detail fetch returned 403; no verified import.
- Leboncoin: Créteil results readable, attempted individual detail URL restricted; no import from search snippets alone.
- Bien’ici: search page fetched only a JavaScript shell; no detail verified.
- Superimmo: discovery results found; detail verification remains outstanding.
- Stream.Estate: configured account returned insufficient credits; user chose public sources.

This records tested paths, not a claim that entire sites are inaccessible or that
all possible sources were searched. Refresh and wider discovery remain future work.
