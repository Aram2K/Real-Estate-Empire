import { parseSellerBadge, type CommuneCandidate } from "../leboncoin/bulk";
import type { SellerType } from "../sellerType";
import { classifySuspiciousListing } from "../listingQuality";
import { isCollectionPostalCode } from "../../constants";

export type GensDeConfianceCard = {
  url?: string;
  text?: string;
  title?: string;
  dpe?: string;
  price?: number;
  propertyType?: string;
  rooms?: number;
  surface?: number;
  city?: string;
  postalCode?: string;
  sellerType?: SellerType;
  sellerName?: string;
  /** ISO timestamp supplied by the browser extractor when available. */
  publishedAt?: string;
};

/** Return why the advert is not an ordinary sale of an entire dwelling. */
export function nonWholePropertyReason(title: string | undefined, description: string | undefined): string | null {
  return classifySuspiciousListing({ title, description }).reasons[0] ?? null;
}

export type ParsedGensDeConfianceCard = {
  externalId: string;
  url: string;
  price: number;
  propertyType: "Appartement" | "Maison";
  rooms: number;
  surface: number;
  city: string;
  postalCode: string;
  dpe: string | null;
  sellerType: SellerType;
  sellerName: string | null;
  publishedAt: Date | null;
};

function finitePositive(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value.replace(/\s/g, "").replace(",", ".")) : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function canonicalUrl(value: string): { externalId: string; url: string } | null {
  try {
    const url = new URL(value);
    if (!/(?:^|\.)gensdeconfiance\.com$/i.test(url.hostname)) return null;
    const match = url.pathname.match(/\/post\/realestate__sale\/([^/?#]+)/i);
    if (!match) return null;
    return {
      externalId: decodeURIComponent(match[1]).toLowerCase(),
      url: `https://gensdeconfiance.com/us/ui/post/realestate__sale/${encodeURIComponent(decodeURIComponent(match[1]).toLowerCase())}`,
    };
  } catch {
    return null;
  }
}

/** Parse either a visible GDC result card or a structured browser extraction. */
export function parseGensDeConfianceCard(card: GensDeConfianceCard, observedAt = new Date()): ParsedGensDeConfianceCard | null {
  const identity = card.url ? canonicalUrl(card.url) : null;
  if (!identity) return null;

  const text = (card.text ?? "").replace(/\u00a0|\u202f/g, " ");
  if (nonWholePropertyReason(card.title, text)) return null;
  const priceMatch = text.match(/(?:prix\s*:?\s*)?([\d][\d ,.]{2,})\s*€/i) ?? text.match(/€[ \t]*([\d][\d ,.]{2,})/i);
  const surfaceFirstFacts = text.match(/\b(appartement|maison|apartment|house)\b\s*(?:·|-|,)?\s*([\d.,]+)\s*m[²2]\s*(?:·|-|,)?\s*(\d+)\s*(?:pi[eè]ces?|rooms?)/i);
  const roomsFirstFacts = surfaceFirstFacts ? null : text.match(/\b(appartement|maison|apartment|house)\b\s*(?:·|-|,)?\s*(\d+)\s*(?:pi[eè]ces?|rooms?)\s*(?:·|-|,)?\s*([\d.,]+)\s*m[²2]/i);
  const facts = surfaceFirstFacts ?? roomsFirstFacts;

  const rawType = card.propertyType ?? facts?.[1];
  const type = rawType?.toLowerCase();
  const propertyType = type === "maison" || type === "house" ? "Maison" : type === "appartement" || type === "apartment" ? "Appartement" : null;
  const surface = finitePositive(card.surface ?? (surfaceFirstFacts?.[2] ?? roomsFirstFacts?.[3]));
  const rooms = finitePositive(card.rooms ?? (surfaceFirstFacts?.[3] ?? roomsFirstFacts?.[2]));
  const euroPrice = card.price !== undefined
    ? finitePositive(card.price)
    : finitePositive(priceMatch?.[1]?.replace(/[\s,.]/g, ""));

  const explicitPostal = card.postalCode?.trim();
  const postalCode = explicitPostal && isCollectionPostalCode(explicitPostal)
    ? explicitPostal
    : [...text.matchAll(/\b(\d{5})\b/g)].map((match) => match[1]).find(isCollectionPostalCode);
  const cityFromParenthesizedPostal = postalCode
    ? text.match(new RegExp(`(?:^|\\n)\\s*([^\\n()]+?)\\s*(?:\\n\\s*)?\\(${postalCode}\\)`, "i"))?.[1]
    : null;
  const cityFromPostalLine = postalCode
    ? text.match(new RegExp(`(?:^|\\n)\\s*([^\\n,()]+?)\\s+${postalCode}(?:\\s|$)`, "i"))?.[1]
    : null;
  const city = card.city?.trim() || cityFromParenthesizedPostal?.trim() || cityFromPostalLine?.trim();

  if (propertyType !== "Appartement" || !surface || !rooms || !Number.isInteger(rooms) || !euroPrice || !postalCode || !city) return null;
  if (classifySuspiciousListing({
    title: card.title,
    description: text,
    priceCents: Math.round(euroPrice * 100),
    surface,
    propertyType,
  }).suspicious) return null;
  const explicitSeller = card.sellerType && ["AGENCY", "INDIVIDUAL", "UNKNOWN"].includes(card.sellerType) ? card.sellerType : null;
  const sellerType = explicitSeller ?? parseSellerBadge(text);
  const dpe = (card.dpe ?? text).match(/(?:classe\s+[ée]nergie|dpe)\s*:?[ ]*([A-G])/i)?.[1]?.toUpperCase() ?? null;
  const publishedAt = parsePublishedAt(card.publishedAt, text, observedAt);

  return {
    ...identity,
    price: Math.round(euroPrice * 100),
    propertyType,
    rooms,
    surface,
    city,
    postalCode,
    dpe,
    sellerType,
    sellerName: card.sellerName?.trim() || null,
    publishedAt,
  };
}

/** Prefer an exact machine-readable timestamp, then interpret common GDC relative labels. */
export function parsePublishedAt(explicit: string | undefined, text: string, observedAt: Date): Date | null {
  if (explicit) {
    const exact = new Date(explicit);
    if (!Number.isNaN(exact.getTime()) && exact <= observedAt) return exact;
  }
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const relative = normalized.match(/(?:publiee?\s+)?il y a\s+(\d+)\s*(minute|heure|jour|semaine)s?/i);
  if (relative) {
    const amount = Number(relative[1]);
    const milliseconds = { minute: 60_000, heure: 3_600_000, jour: 86_400_000, semaine: 604_800_000 }[relative[2] as "minute" | "heure" | "jour" | "semaine"];
    return new Date(observedAt.getTime() - amount * milliseconds);
  }
  const clock = normalized.match(/(?:publiee?\s+)?(aujourd'hui|hier)\s+a\s+(\d{1,2})[h:]([0-5]\d)/i);
  if (clock) {
    const result = new Date(observedAt);
    result.setHours(Number(clock[2]), Number(clock[3]), 0, 0);
    if (clock[1] === "hier") result.setDate(result.getDate() - 1);
    if (result <= observedAt) return result;
  }
  return null;
}

export function isGensDeConfianceCard(card: { url?: string }): boolean {
  return !!card.url && canonicalUrl(card.url) !== null;
}

export type { CommuneCandidate };
