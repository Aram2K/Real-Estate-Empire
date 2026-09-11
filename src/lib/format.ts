/** Formatting helpers. Money values coming in are integer euro-cents. */

const EUR = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const EUR2 = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** €123,456 (no decimals) from cents. */
export function euro(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "—";
  return EUR.format(cents / 100);
}

/** €1,234.56 (2 decimals) from cents — for monthly figures. */
export function euro2(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "—";
  return EUR2.format(cents / 100);
}

/** Signed monthly figure, e.g. "+€112" / "−€45". */
export function euroSigned(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "—";
  const sign = cents >= 0 ? "+" : "−";
  return `${sign}${EUR.format(Math.abs(cents) / 100)}`;
}

/** "8.5%" from a plain number like 8.53. */
export function pct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

/** "1.22" from a ratio; "∞" for infinite DSCR. */
export function ratio(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(digits);
}

export function euroFromUnits(euros: number): string {
  return EUR.format(euros);
}

/** Distance in metres → "620 m" or "1.2 km". */
export function distance(metres: number | null | undefined): string {
  if (metres == null || Number.isNaN(metres)) return "—";
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
