/** Île-de-France departments. */
export const IDF_DEPARTMENTS = [
  { code: "75", name: "Paris" },
  { code: "77", name: "Seine-et-Marne" },
  { code: "78", name: "Yvelines" },
  { code: "91", name: "Essonne" },
  { code: "92", name: "Hauts-de-Seine" },
  { code: "93", name: "Seine-Saint-Denis" },
  { code: "94", name: "Val-de-Marne" },
  { code: "95", name: "Val-d'Oise" },
] as const;

export const IDF_DEPARTMENT_CODES = IDF_DEPARTMENTS.map((d) => d.code);

export const MARKET_PERIOD = "2021-2025";

/** DVF years to ingest (rolling 5-year window available upstream). */
export const DVF_YEARS = [2021, 2022, 2023, 2024, 2025] as const;

/** Investment-score → classification bands (PRD §22). */
export function investmentBand(score: number): {
  label: string;
  key: string;
} {
  if (score >= 90) return { label: "Excellent", key: "excellent" };
  if (score >= 80) return { label: "Strong", key: "strong" };
  if (score >= 70) return { label: "Interesting", key: "interesting" };
  if (score >= 60) return { label: "Watch", key: "watch" };
  return { label: "Weak", key: "weak" };
}
