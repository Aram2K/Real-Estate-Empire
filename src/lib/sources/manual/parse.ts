/**
 * Best-effort parser for listing text a user copies from a portal they're
 * browsing (Gens de Confiance, Leboncoin, SeLoger, …). The user supplies the
 * text; we just extract fields to pre-fill the import form for them to confirm.
 * Handles FR ("149 500 €", "149.500") and US ("€149,500") number formats.
 */
export interface ParsedListing {
  priceEuros?: number;
  surface?: number;
  rooms?: number;
  dpe?: string;
  postcode?: string;
  propertyType?: "Appartement" | "Maison";
}

function toNumber(raw: string): number {
  // strip spaces, non-breaking spaces and thousands separators
  return Number(raw.replace(/[\s .,]/g, ""));
}

export function parseListingText(text: string): ParsedListing {
  const t = text.replace(/ /g, " ");
  const out: ParsedListing = {};

  // --- price: numbers adjacent to € / EUR; take the largest plausible one ---
  const priceCandidates: number[] = [];
  const re = /(?:€|EUR)\s*([\d][\d\s.,]{2,})|([\d][\d\s.,]{2,})\s*(?:€|EUR)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const n = toNumber(m[1] ?? m[2] ?? "");
    if (Number.isFinite(n)) priceCandidates.push(n);
  }
  const plausible = priceCandidates.filter((n) => n >= 20000 && n <= 5_000_000);
  if (plausible.length) out.priceEuros = Math.max(...plausible);

  // --- surface (m²) --- (handle "32 m²" and "32 m2" separately; ² breaks \b)
  const sm =
    t.match(/(\d+(?:[.,]\d+)?)\s*m²/i) ?? t.match(/(\d+(?:[.,]\d+)?)\s*m2\b/i);
  if (sm) out.surface = Number(sm[1].replace(",", "."));

  // --- rooms: "3 rooms", "3 pièces", "T3", "F3" ---
  const rm =
    t.match(/(\d+)\s*(?:rooms?|pi[eè]ces?)/i) ?? t.match(/\b[TF](\d)\b/i);
  if (rm) out.rooms = Number(rm[1]);

  // --- DPE ---
  const dm = t.match(/\bDPE\b[\s:–-]*([A-G])\b/i);
  if (dm) out.dpe = dm[1].toUpperCase();

  // --- postcode (French 5-digit; prefer IDF 75/77/78/91-95) ---
  const pcs = [...t.matchAll(/\b(\d{5})\b/g)].map((x) => x[1]);
  const idf = pcs.find((p) => /^(75|77|78|91|92|93|94|95)/.test(p));
  out.postcode = idf ?? pcs[0];

  // --- type ---
  if (/\b(maison|house|villa|pavillon)\b/i.test(t)) out.propertyType = "Maison";
  else if (/\b(appartement|apartment|flat|studio)\b/i.test(t))
    out.propertyType = "Appartement";

  return out;
}
