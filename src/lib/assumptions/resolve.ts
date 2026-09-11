import type { ResolvedAssumptions } from "@/lib/finance/types";
import { DEFAULT_ASSUMPTIONS } from "./defaults";

/** Merge global defaults ⊕ overrides into a concrete resolved assumption set. */
export function resolveAssumptions(
  overrides?: Partial<ResolvedAssumptions> | null
): ResolvedAssumptions {
  return { ...DEFAULT_ASSUMPTIONS, ...(overrides ?? {}) };
}
