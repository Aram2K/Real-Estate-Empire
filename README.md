# IDF Investment Radar

Map, score and stress-test residential rental-investment opportunities across
Île-de-France. Finds properties you could buy with **little or no money down**,
where the tenant covers the full cost of ownership (an **opération blanche**),
with a safety margin and strong long-term location fundamentals.

- **Interactive map** — commune/arrondissement hotspot choropleth (yield, price,
  rent, demand, transport, appreciation), deal markers coloured by investment
  score, and **Grand Paris Express future stations**.
- **Deterministic finance engine** — mortgage, cash flow, DSCR, yields,
  opération-blanche classification, **break-even purchase price**, negotiation
  scenarios. Pure TypeScript, fully unit-tested. No LLM in the maths.
- **Scoring** — transport catalyst, rental demand, appreciation potential and an
  overall investment score (0–100).
- **Deal detail** — full expense breakdown, break-even price, negotiation
  scenarios, DVF sold-comparable comparison, risk flags, and a live
  assumptions "what-if" (rate / term / financing / rent scenario).
- **Reverse deal finder**, saved properties, and manual listing import.

## Data & legality

This project does **not** scrape listing portals (their terms prohibit it and
they use anti-bot protection). Listings come from:

1. **Melo / Stream.Estate** — a licensed aggregator API (Leboncoin, SeLoger,
   Bien'ici, etc.). Set `MELO_API_KEY` and add account credits to enable.
2. **Manual import** — paste a deal you found yourself (e.g. on Gens de
   Confiance); the app geocodes and analyses it.
3. **Demo listings** — generated from real DVF sale prices (flagged as demo) so
   the map is alive out of the box.

Everything else is real French **open data**: DVF sale transactions, Carte des
Loyers rent indicators, Paris rent-control reference rents, INSEE populations,
and Île-de-France Mobilités rail stations.

> All figures are **estimates**, not guaranteed returns. Appreciation is an
> estimate, not a forecast. Grand Paris Express opening dates are Société des
> grands projets estimates and may change.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · Leaflet + OpenStreetMap ·
Prisma + SQLite (zero-infra; spatial done in TypeScript at IDF scale).

## Setup

Requires Node 20+.

```bash
npm install
cp .env.example .env        # optionally set MELO_API_KEY
npm run db:setup            # generate client and create/update SQLite tables
```

Build the database from open data (downloads a few hundred MB, several minutes):

```bash
npm run ingest:all
```

Faster subset (inner ring + Paris, recent years) if you just want to try it:

```bash
npm run ingest:communes
npm run seed:gpe && npm run seed:hubs && npm run ingest:stations && npm run ingest:population
npm run ingest:dvf -- 75 92 93 94 --years 2024,2025
npm run ingest:rents
npm run compute:market && npm run compute:scores
npm run seed:demo && npm run compute:analyses
```

Run the app:

```bash
npm run dev        # http://localhost:3000
```

## Tests

```bash
npm test           # finance + scoring engines (deterministic, no DB)
```

## Project layout

- `src/lib/finance/*` — pure finance engine (the heart; unit-tested).
- `src/lib/scoring/*` — pure 0–100 scorers with PRD weights.
- `src/lib/analysis/*` — ties finance + scoring to a property + its context.
- `src/lib/sources/*` — listing source adapters (Melo, extensible).
- `scripts/*` — ingestion CLIs (`tsx`), orchestrated by `run-all.ts`.
- `src/app/*` — pages (map, deals, detail, deal-finder, import, saved, settings)
  and API routes.
- `prisma/schema.prisma` — data model. `prisma/seed/*` — GPE stations,
  employment hubs.

## Changing assumptions

Global defaults live in `src/lib/assumptions/defaults.ts` (rate 3.6%, 25y, 110%
financing, 5% vacancy, 5% maintenance). Edit and re-run
`npm run compute:analyses`. Per-property overrides are available live on each
deal page.

## Enabling real listings (Melo)

### Publicly reviewed listings (no API subscription)

The reviewed batches contain 22 public adverts across all eight IDF departments,
from Century 21, Laforêt, iad, SAFTI, PAP, Capifrance and Orpi.
Each record retains its original URL, review date and factual notes.
This is a manually curated snapshot, not an automatically refreshed feed; agency
availability must still be confirmed. Import it with:

```bash
npm run import:reviewed -- scripts/reviewed/2026-09-05.json
npm run import:reviewed -- scripts/reviewed/2026-09-05-expanded.json
npm run import:reviewed -- scripts/reviewed/2026-09-05-west-east.json
```

Re-imports use the source URL as identity and do not duplicate unchanged price
observations. Exact locations and unknown DPEs are left unset. These listings
appear in Deals, the dashboard and grouped town-centre map markers. These markers
are explicitly approximate and do not supply coordinates for distance scoring.
Listing notes distinguish advertised rents from the engine's market
rent estimates and record conflicts in published charges.

### Licensed feed

1. Add credits at <https://stream.estate/console/billing>.
2. Ensure `MELO_API_KEY` is set in `.env`.
3. `npm run ingest:listings`

The Melo document field-mapping in `src/lib/sources/melo/adapter.ts` is defensive
and should be confirmed against a live sample once credits are active.
