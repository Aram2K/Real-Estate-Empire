/**
 * A cheap, cross-process "has the database changed?" signal.
 *
 * The Next server caches expensive read results, but the data is written by
 * other processes too: import and compute scripts, and other tools working on
 * the same database file. An in-process cache cannot be told about those writes,
 * so it asks the file instead.
 *
 * The version combines:
 *
 * - SQLite's file change counter (bytes 24–27 of the database header). In
 *   rollback-journal mode SQLite increments it on every committed write
 *   transaction, whichever process makes it — including a status-only update
 *   such as withdrawing a listing, which leaves row counts and timestamps alone.
 * - The size and modification time of the database file and of its -wal and
 *   -journal companions. In WAL mode a commit touches only the -wal file until a
 *   checkpoint, so that file has to be part of the stamp.
 * - A content checksum over the data the app actually serves, refreshed at most
 *   every CONTENT_CHECK_MS. It is a backstop for a write the file signal could
 *   miss, and bounds any staleness to that interval.
 *
 * Reading the version costs well under a millisecond on a normal request.
 */
import { closeSync, openSync, readSync, statSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";

const CONTENT_CHECK_MS = 30_000;

/** Resolve the SQLite file the Prisma client reads, or null if it is not a local file. */
function databasePath(): string | null {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) return null;
  const file = url.slice("file:".length).split("?")[0];
  if (!file) return null;
  // Prisma resolves a relative SQLite path against the schema directory.
  return path.isAbsolute(file) ? file : path.resolve(process.cwd(), "prisma", file);
}

function statStamp(file: string): string {
  try {
    const s = statSync(file);
    return `${s.size}:${s.mtimeMs}`;
  } catch {
    return "-";
  }
}

function changeCounter(file: string): string {
  let fd: number | undefined;
  try {
    fd = openSync(file, "r");
    const header = Buffer.alloc(4);
    readSync(fd, header, 0, 4, 24);
    return String(header.readUInt32BE(0));
  } catch {
    return "-";
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function fileStamp(): string | null {
  const db = databasePath();
  if (!db) return null;
  return [changeCounter(db), statStamp(db), statStamp(`${db}-wal`), statStamp(`${db}-journal`)].join("|");
}

type ContentRow = Record<string, number | bigint | string | null>;

async function contentStamp(): Promise<string> {
  const [row] = await prisma.$queryRaw<ContentRow[]>`
    SELECT
      (SELECT COUNT(*) FROM Listing WHERE status = 'ACTIVE') AS activeListings,
      (SELECT TOTAL(price) FROM Listing WHERE status = 'ACTIVE') AS activePrice,
      (SELECT TOTAL(LENGTH(sellerType)) FROM Listing WHERE status = 'ACTIVE') AS sellerTypes,
      (SELECT MAX(lastSeenAt) FROM Listing) AS lastSeen,
      (SELECT COUNT(*) FROM InvestmentAnalysis) AS analyses,
      (SELECT TOTAL(investmentScore) FROM InvestmentAnalysis) AS scoreTotal,
      (SELECT MAX(computedAt) FROM InvestmentAnalysis) AS lastComputed,
      (SELECT COUNT(*) FROM Property) AS properties
  `;
  return Object.values(row ?? {}).map(String).join(",");
}

const state = globalThis as unknown as {
  __dataVersionContent?: { value: string; checkedAt: number; pending?: Promise<string> };
};

/**
 * The current data version. Two calls return the same string only if nothing
 * observable has been written to the database between them (within the
 * content-check interval, for the rare write the file signal misses).
 *
 * Callers must read the version BEFORE loading the data they cache, and store
 * the data under that version: a write that lands during the load then shows up
 * as a newer version on the next request, rather than being treated as already
 * included.
 */
export async function getDataVersion(): Promise<string> {
  const file = fileStamp();
  const now = Date.now();
  const content = state.__dataVersionContent;

  if (!content || now - content.checkedAt > CONTENT_CHECK_MS) {
    if (!content?.pending) {
      const pending = contentStamp();
      state.__dataVersionContent = { value: content?.value ?? "", checkedAt: content?.checkedAt ?? 0, pending };
      try {
        const value = await pending;
        state.__dataVersionContent = { value, checkedAt: Date.now() };
      } catch {
        // A failed check must not pin a stale version; retry on the next call.
        state.__dataVersionContent = { value: `error:${now}`, checkedAt: 0 };
      }
    } else {
      await content.pending.catch(() => undefined);
    }
  }

  // Without a local database file, fall back to a version that changes on
  // every call, which disables caching rather than risking stale data.
  if (file === null) return `nofile:${now}:${Math.random()}`;
  return `${file}#${state.__dataVersionContent?.value ?? ""}`;
}

/**
 * Memoize an async loader per data version.
 *
 * A request only shares an in-flight load started under the same version, so a
 * load that began before a write can never be handed to a request made after
 * it. A failed load is not cached.
 */
export function versionedMemo<T>(key: string, load: () => Promise<T>): () => Promise<T> {
  const slot = globalThis as unknown as Record<string, { version: string; promise: Promise<T> } | undefined>;
  const name = `__versionedMemo:${key}`;
  return async () => {
    const version = await getDataVersion();
    const hit = slot[name];
    if (hit && hit.version === version) return hit.promise;
    const promise = load();
    slot[name] = { version, promise };
    try {
      return await promise;
    } catch (error) {
      if (slot[name]?.promise === promise) slot[name] = undefined;
      throw error;
    }
  };
}
