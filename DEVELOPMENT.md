# Development status

Inspected 5 September 2026. Working target: a local, single-user investment research tool.

## Existing foundation

Next.js application with a SQLite database, map, deterministic finance and scoring engines, property detail and what-if analysis, manual import, saved properties, and ingestion scripts. The existing database contains 1,286 communes, 350,707 sale comparables, 5,160 rent references, 1 real property and 1,938 demo properties. These are loaded-record counts, not proof of current or complete market coverage.

## Reliability improvements

- Database setup now uses the existing SQLite schema instead of a missing PostGIS migration script.
- Manual import validates region, commune coverage, DPE and listing URL; geocoding has a timeout and retryable error response.
- Successful imports add properties to Saved and capture initial and changed asking prices.
- Saved properties are queried by their IDs instead of filtered from a capped list of all deals. Saving without a note preserves existing notes.
- Import, saved and detail screens handle request failures. Detail reads the persisted saved state.
- Settings shows loaded data counts and configuration status without exposing credentials.

## Next development stages

### Public listing import added

At the user's request to use public listings, eight reviewed Century 21 agency
adverts were imported: five in Évry-Courcouronnes and three in Melun. The database
now has nine non-demo properties. Review records and source URLs are in
`scripts/reviewed/2026-09-05.json`; replay with `npm run import:reviewed -- <file>`.
All eight have computed analyses. Replaying the batch was verified to leave eight
reviewed listings and eight initial price observations, with no duplicates.
Listing notes are now visible in property detail. No exact property address was
published in the reviewed text, so no coordinates were invented.

The configured Stream.Estate key was tested with a one-item IDF query and returned
HTTP 403 with "Insufficient credits". Its adapter also uses incorrect query
parameters (`transactionType=sale` instead of documented `0`, and generic price
filters instead of budget filters). The paid feed remains unvalidated; no plan
was purchased and public-source review is the chosen approach for now.

### Remaining work

Listing details now link to `/map?property=<id>`. The map focuses that property
and provides a destination and travel-mode panel. Car routes use the public OSRM
service through `/api/directions`, with Géoplateforme destination geocoding;
distance and time exclude live traffic. Transit, walking and cycling itineraries
open Google Maps with the selected origin/destination/mode (no paid API key).
An exact-address form validates a street-number match within the listing commune,
persists the coordinates and recalculates analysis. Three validation tests cover it.
In-map transit itineraries still require a routing data provider integration.
Provider docs: https://project-osrm.org/docs/v5.22.0/api/ and
https://developers.google.com/maps/documentation/urls/get-started .

Map coverage now uses display-only commune centres for listings without exact
coordinates. Numbered groups expose every property, including coincident points.
The initial view fits listing locations; shading defaults to loaded listing counts
and all metric modes leave towns without listings unfilled. Approximate positions
never feed transport-distance calculations. Two grouping regression tests added.

Public coverage was expanded to 22 reviewed adverts from seven publishers, across
all eight departments (23 real properties including the previous manual import).
See `scripts/reviewed/COVERAGE.md` and the two additional JSON batches.
All 14 newly added records were imported and analyzed successfully; the live
real-only API returns 23 items with all eight departments represented.

1. Validate the Melo field mapping with an actual authorized provider response. Confirm account access and costs before starting paid ingestion. Add adapter fixtures, deduplication by stable listing identity, withdrawn-listing handling and a visible sync history.
2. Make analysis provenance explicit: source/year of the rent estimate, comparable sample size, and warnings when generic fallback rents are used. Separate house and apartment market references; audit the current Paris reference-rent aggregation before relying on it for regulated-rent decisions.
3. Add editable, persisted assumptions with consistent recalculation across map, shortlist and property detail. Add manual rent and renovation estimates and property editing.
4. Add durable SQLite backups and repeatable ingestion operations. The current project directory has no Git repository; establish version control before larger changes.
5. Before public hosting, add authentication and per-user ownership. OWNER_ID currently identifies one shared local user and is not authentication. Choose hosting with persistent database storage, then validate migrations and recovery.

The current app calculates estimates. A passing build and engine tests do not validate live listing coverage, lending availability, tax treatment, or the freshness of legal and transport assumptions.
# Fast Leboncoin page-range imports

For a large, authenticated browser sweep, open an Île-de-France sales search on
Leboncoin, open DevTools Console, adjust and paste
`scripts/leboncoin-browser-harvester.js`. The script divides results into
non-overlapping price and seller-type segments, reads the actual page count for
each segment, fetches four pages at a time, and imports each completed segment.
This works around Leboncoin's 100-page search cap and avoids losing a long sweep
if the browser closes. It preserves advert URLs and source-stated seller and
location fields. The server still rejects incomplete, unmapped, and non-IDF
records.

Keep the app running on port 3100 during the sweep. The bulk endpoint deliberately
defers investment analysis; after the browser reports completion, run:

```bash
npm run compute:analyses:new
```
