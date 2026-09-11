/**
 * Grand Paris Express future stations — hand-curated seed.
 *
 * There is no authoritative open dataset combining geometry + line + opening
 * date (SGP's shapefile is stale 2016 and IDFM excludes GPE). Coordinates here
 * are curated approximations (good to a few hundred metres — fine for
 * neighbourhood-level catalyst scoring) and MUST be treated as estimates.
 *
 * Opening years reflect the Société des grands projets revision of 25 June 2026.
 * Lines 15 Sud / 16 / 17 share the same CBTC automation and slip together.
 * Dates are ESTIMATES, never guarantees — the UI must say so.
 *
 * Only not-yet-open stations belong here; already-open stations (e.g. Line 14
 * extensions) come from the IDFM existing-stations dataset.
 */

import { PLANNED_STATIONS, type PlannedStation } from "../../src/lib/geo/plannedTransit";

export type GpeSeed = PlannedStation;

const SGP = "Société des grands projets & IDFM — Planned Mobilité 2026";

export const GPE_STATIONS: GpeSeed[] = PLANNED_STATIONS;
export const GPE_SOURCE = SGP;

