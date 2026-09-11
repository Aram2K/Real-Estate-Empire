export type ExportableListing = {
  source: string;
  externalId: string;
  url: string;
  status: "ACTIVE";
  firstSeenAt: string;
  lastSeenAt: string;
  priceCents: number;
  sellerType: string;
  sellerName: string | null;
  property: {
    dedupeKey: string;
    communeCode: string;
    addressLine: string | null;
    longitude: number | null;
    latitude: number | null;
    surface: number;
    rooms: number;
    propertyType: string;
    dpe: string | null;
    ges: string | null;
  };
};

export function chunkRecords<T>(records: T[], size: number): T[][] {
  if (!Number.isSafeInteger(size) || size < 1) throw new Error("Chunk size must be a positive integer");
  const chunks: T[][] = [];
  for (let index = 0; index < records.length; index += size) chunks.push(records.slice(index, index + size));
  return chunks;
}

export function toJsonLines(records: unknown[]): string {
  return records.map((record) => JSON.stringify(record)).join("\n") + (records.length ? "\n" : "");
}
