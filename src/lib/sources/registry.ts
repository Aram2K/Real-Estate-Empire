import { meloAdapter } from "./melo/adapter";
import type { ListingSourceAdapter } from "./types";

const ALL: ListingSourceAdapter[] = [meloAdapter];

/** Adapters that are configured/available in this environment. */
export function getEnabledAdapters(): ListingSourceAdapter[] {
  return ALL.filter((a) => a.isAvailable());
}
