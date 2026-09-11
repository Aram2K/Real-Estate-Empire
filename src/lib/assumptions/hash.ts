import { createHash } from "node:crypto";
import type { ResolvedAssumptions } from "@/lib/finance/types";

/** Stable short hash of a resolved assumption set → InvestmentAnalysis cache key. */
export function hashAssumptions(a: ResolvedAssumptions): string {
  const keys = Object.keys(a).sort();
  const canonical = JSON.stringify(
    keys.map((k) => [k, (a as unknown as Record<string, unknown>)[k]])
  );
  return createHash("sha1").update(canonical).digest("hex").slice(0, 16);
}
