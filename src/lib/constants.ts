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

/**
 * Departments currently targeted for new listing collection and market-data
 * ingestion. Paris is deliberately excluded from new collection; its existing
 * records remain available for historical comparison. The departments below
 * cover the ordered regional-city rollout and their surrounding communes.
 */
export const COLLECTION_DEPARTMENTS = [
  { code: "76", name: "Seine-Maritime (Rouen)" },
  { code: "45", name: "Loiret (Orléans)" },
  { code: "51", name: "Marne (Reims)" },
  { code: "80", name: "Somme (Amiens)" },
  { code: "10", name: "Aube (Troyes)" },
  { code: "27", name: "Eure (Évreux)" },
  { code: "28", name: "Eure-et-Loir (Chartres)" },
  { code: "60", name: "Oise (Beauvais / Compiègne)" },
  { code: "89", name: "Yonne (Sens / Auxerre)" },
  { code: "72", name: "Sarthe (Le Mans)" },
  { code: "14", name: "Calvados (Caen)" },
  { code: "37", name: "Indre-et-Loire (Tours)" },
] as const;

/** Process these markets in this order, beginning with the closest large hubs. */
export const COLLECTION_MARKETS = [
  { city: "Rouen", department: "76", communeCodes: ["76540", "76681", "76575", "76498", "76322", "76451", "76216"] },
  { city: "Orléans", department: "45", communeCodes: ["45234", "45147", "45232", "45284", "45285", "45075"] },
  { city: "Reims", department: "51", communeCodes: ["51454", "51573", "51055", "51172", "51492", "51058"] },
  { city: "Amiens", department: "80", communeCodes: ["80021", "80489", "80164", "80674", "80725", "80131"] },
  { city: "Troyes", department: "10", communeCodes: ["10387", "10362", "10081", "10333", "10297", "10343"] },
  { city: "Le Mans", department: "72", communeCodes: ["72181", "72003", "72095", "72008", "72058", "72065"] },
  { city: "Tours", department: "37", communeCodes: ["37261", "37122", "37233", "37214", "37195", "37050"] },
  { city: "Caen", department: "14", communeCodes: ["14118", "14327", "14437", "14341", "14167", "14181"] },
  { city: "Chartres", department: "28", communeCodes: ["28085", "28218", "28229", "28220", "28110", "28070"] },
  { city: "Évreux", department: "27", communeCodes: ["27229", "27299", "27602", "27306", "27684"] },
  { city: "Beauvais", department: "60", communeCodes: ["60057", "60009", "60639", "60277"] },
  { city: "Compiègne", department: "60", communeCodes: ["60159", "60382", "60665", "60325", "60151"] },
  { city: "Sens", department: "89", communeCodes: ["89387", "89338", "89287", "89342"] },
  { city: "Auxerre", department: "89", communeCodes: ["89024", "89263", "89346", "89013"] },
] as const;

export const COLLECTION_COMMUNE_CODES = new Set<string>(COLLECTION_MARKETS.flatMap((market) => [...market.communeCodes]));

export const COLLECTION_DEPARTMENT_CODES = COLLECTION_DEPARTMENTS.map((d) => d.code);

export function isCollectionPostalCode(postalCode: string): boolean {
  return /^\d{5}$/.test(postalCode) && COLLECTION_DEPARTMENT_CODES.some((code) => postalCode.startsWith(code));
}

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
