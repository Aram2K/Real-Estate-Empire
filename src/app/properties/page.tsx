"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { PropertyListItem } from "@/lib/properties/query";
import { PRESET_LABELS } from "@/lib/filters/schema";
import { euro, euroSigned, pct } from "@/lib/format";
import { cashFlowLabel, cashFlowStyle, scoreColor, WHITE_STATUS_META } from "@/lib/ui/score";
import { DepartmentMiniMap } from "@/components/property/DepartmentMiniMap";
import { SELLER_TYPE_META, type SellerType } from "@/lib/sources/sellerType";

interface Filters {
  preset?: string;
  departements: string[];
  communeCodes: string[];
  priceMax?: string;
  rooms: string[];
  sellerType?: string;
  allInYieldMin?: string;
  cashFlowMin?: string;
  dscrMin?: string;
  investmentScoreMin?: string;
  safetyMin?: string;
  whiteOnly: boolean;
  includeDemo: boolean;
  sort: string;
}

function initialFrom(sp: URLSearchParams): Filters {
  const list = (k: string) =>
    sp.get(k) ? sp.get(k)!.split(",").filter(Boolean) : [];
  return {
    preset: sp.get("preset") ?? undefined,
    departements: list("departements"),
    communeCodes: list("communeCodes"),
    priceMax: sp.get("priceMax") ?? undefined,
    rooms: sp.get("rooms")?.split(",").filter(Boolean) ?? (sp.get("roomsMin") ? [sp.get("roomsMin") === "6" ? "6+" : sp.get("roomsMin")!] : []),
    sellerType: sp.get("sellerTypes") ?? undefined,
    allInYieldMin: sp.get("allInYieldMin") ?? undefined,
    cashFlowMin: sp.get("cashFlowMin") ?? undefined,
    dscrMin: sp.get("dscrMin") ?? undefined,
    investmentScoreMin: sp.get("investmentScoreMin") ?? undefined,
    safetyMin: sp.get("safetyMin") ?? undefined,
    whiteOnly: sp.get("whiteStatus") ? true : false,
    includeDemo: sp.get("includeDemo") === "true", // real listings only by default
    sort: sp.get("sort") ?? "investmentScore",
  };
}

function DealsInner() {
  const INITIAL_ROWS = 40;
  const ROW_INCREMENT = 40;
  const MAX_VISIBLE_ROWS = 200;
  const sp = useSearchParams();
  const initial = useMemo(() => initialFrom(new URLSearchParams(sp.toString())), [sp]);
  const [f, setF] = useState<Filters>(initial);
  const [items, setItems] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tableSort, setTableSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "investmentScore", direction: "desc" });
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async (filters: Filters) => {
    setLoading(true);
    const qp = new URLSearchParams();
    if (filters.preset) qp.set("preset", filters.preset);
    if (filters.departements.length) qp.set("departements", filters.departements.join(","));
    if (filters.communeCodes.length) qp.set("communeCodes", filters.communeCodes.join(","));
    if (filters.priceMax) qp.set("priceMax", filters.priceMax);
    const exactRooms = filters.rooms.filter((room) => room !== "6+");
    if (exactRooms.length) qp.set("rooms", exactRooms.join(","));
    if (filters.rooms.includes("6+")) qp.set("roomsAtLeast", "6");
    if (filters.sellerType) qp.set("sellerTypes", filters.sellerType);
    if (filters.allInYieldMin) qp.set("allInYieldMin", filters.allInYieldMin);
    if (filters.cashFlowMin) qp.set("cashFlowMin", filters.cashFlowMin);
    if (filters.dscrMin) qp.set("dscrMin", filters.dscrMin);
    if (filters.investmentScoreMin) qp.set("investmentScoreMin", filters.investmentScoreMin);
    if (filters.safetyMin) qp.set("safetyMin", filters.safetyMin);
    if (filters.whiteOnly) qp.set("whiteStatus", "FULL,STRONG,EXCELLENT");
    qp.set("includeDemo", String(filters.includeDemo));
    qp.set("sort", filters.sort);
    qp.set("limit", "300");
    const res = await fetch(`/api/properties?${qp.toString()}`);
    const json = await res.json();
    setItems(json.items ?? []);
    setVisibleCount(INITIAL_ROWS);
    setLoading(false);
  }, [INITIAL_ROWS]);

  useEffect(() => {
    run(initial);
    fetch("/api/saved")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setSavedIds(new Set((data.saved ?? []).map((item: { propertyId: string }) => item.propertyId))))
      .catch(() => setSaveError("Saved-property status could not be loaded."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSaved = async (propertyId: string) => {
    if (savingIds.has(propertyId)) return;
    const wasSaved = savedIds.has(propertyId);
    setSaveError(null);
    setSavedIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(propertyId); else next.add(propertyId);
      return next;
    });
    setSavingIds((current) => new Set(current).add(propertyId));
    try {
      const response = await fetch(
        wasSaved ? `/api/saved?propertyId=${encodeURIComponent(propertyId)}` : "/api/saved",
        wasSaved
          ? { method: "DELETE" }
          : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId }) },
      );
      if (!response.ok) throw new Error("Save request failed");
    } catch {
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(propertyId); else next.delete(propertyId);
        return next;
      });
      setSaveError("The saved-property change failed. Please try again.");
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(propertyId);
        return next;
      });
    }
  };

  const apply = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    setF(next);
    run(next);
  };

  const toggleDept = (code: string) =>
    apply({
      departements: f.departements.includes(code)
        ? f.departements.filter((d) => d !== code)
        : [...f.departements, code],
    });

  const toggleRoom = (room: string) =>
    apply({ rooms: f.rooms.includes(room) ? f.rooms.filter((value) => value !== room) : [...f.rooms, room] });

  const sortedItems = useMemo(() => {
    const value = (item: PropertyListItem, key: string): string | number => {
      switch (key) {
        case "property": return `${item.commune} ${item.rooms ?? 0} ${item.surface ?? 0}`;
        case "price": return item.priceCents;
        case "cashFlow": return item.monthlyCashFlowCents;
        case "dscr": return item.dscr;
        case "allInYield": return item.allInGrossYieldPct;
        case "demand": return item.rentalDemandScore;
        case "transport": return item.transportScore;
        case "safety": return item.safetyScore ?? -1;
        case "status": return item.whiteStatus;
        default: return item.investmentScore;
      }
    };
    return [...items].sort((a, b) => {
      const av = value(a, tableSort.key), bv = value(b, tableSort.key);
      const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return tableSort.direction === "asc" ? comparison : -comparison;
    });
  }, [items, tableSort]);

  const rowLimit = Math.min(MAX_VISIBLE_ROWS, sortedItems.length);
  const visibleItems = sortedItems.slice(0, Math.min(visibleCount, rowLimit));
  const canLoadMore = visibleItems.length < rowLimit;

  useEffect(() => {
    setVisibleCount(INITIAL_ROWS);
  }, [tableSort, INITIAL_ROWS]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !canLoadMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((count) => Math.min(count + ROW_INCREMENT, rowLimit));
      }
    }, { rootMargin: "240px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [canLoadMore, rowLimit, ROW_INCREMENT]);

  const sortBy = (key: string) => setTableSort((current) => ({
    key,
    direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
  }));
  const sortableHeader = (label: string, key: string, className = "") => (
    <th className={className} aria-sort={tableSort.key === key ? (tableSort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button onClick={() => sortBy(key)} className="inline-flex items-center gap-1 py-2 font-semibold hover:text-slate-900">
        {label}<span aria-hidden="true" className="text-[10px]">{tableSort.key === key ? (tableSort.direction === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold">Deals</h1>
      <p className="mb-4 text-sm text-slate-500">
        {loading ? "Loading…" : `${items.length} properties match your filters`}
      </p>
      {saveError && <p role="alert" className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>}
      <span className="sr-only" aria-live="polite">
        {savingIds.size ? "Updating saved properties" : "Saved properties are up to date"}
      </span>

      {f.communeCodes.length > 0 && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
          Filtered to commune {f.communeCodes.join(", ")}
          <button
            onClick={() => apply({ communeCodes: [] })}
            className="font-bold"
            aria-label="Clear commune filter"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(PRESET_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => apply({ preset: f.preset === key ? undefined : key })}
            className={`rounded-full border px-3 py-1 text-sm ${
              f.preset === key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-3 text-sm">
        <DepartmentMiniMap selected={f.departements} onToggle={toggleDept} />
        <fieldset>
          <legend className="text-xs text-slate-500">Number of rooms</legend>
          <div className="mt-1 flex gap-1" aria-label="Number of rooms">
            {["1", "2", "3", "4", "5", "6+"].map((room) => (
              <button key={room} type="button" aria-pressed={f.rooms.includes(room)} onClick={() => toggleRoom(room)} className={`rounded border px-2 py-1 ${f.rooms.includes(room) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 bg-white"}`}>
                {room}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col">
          <span className="text-xs text-slate-500">Max price (€)</span>
          <input type="number" className="w-28 rounded border border-slate-300 px-2 py-1" defaultValue={f.priceMax}
            onBlur={(e) => apply({ priceMax: e.target.value })} />
        </label>
        <label className="flex flex-col">
          <span className="text-xs text-slate-500">Advertiser</span>
          <select value={f.sellerType ?? ""} onChange={(e) => apply({ sellerType: e.target.value || undefined })} className="w-44 rounded border border-slate-300 px-2 py-1">
            <option value="">All sellers</option>
            <option value="AGENCY">Agency / professional</option>
            <option value="INDIVIDUAL">Private individual</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </label>
        <label className="flex flex-col">
          <span className="text-xs text-slate-500">Min all-in yield %</span>
          <input type="number" className="w-24 rounded border border-slate-300 px-2 py-1" defaultValue={f.allInYieldMin}
            onBlur={(e) => apply({ allInYieldMin: e.target.value })} />
        </label>
        <label className="flex flex-col">
          <span className="text-xs text-slate-500">Min cash flow €/mo</span>
          <input type="number" className="w-24 rounded border border-slate-300 px-2 py-1" defaultValue={f.cashFlowMin}
            onBlur={(e) => apply({ cashFlowMin: e.target.value })} />
        </label>
        <label className="flex flex-col">
          <span className="text-xs text-slate-500">Min DSCR</span>
          <input type="number" step="0.05" className="w-20 rounded border border-slate-300 px-2 py-1" defaultValue={f.dscrMin}
            onBlur={(e) => apply({ dscrMin: e.target.value })} />
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={f.whiteOnly} onChange={(e) => apply({ whiteOnly: e.target.checked })} />
          White only
        </label>
        <label className="flex flex-col">
          <span className="text-xs text-slate-500">Min safety / 100</span>
          <input type="number" min="0" max="100" className="w-24 rounded border border-slate-300 px-2 py-1" defaultValue={f.safetyMin}
            onBlur={(e) => apply({ safetyMin: e.target.value })} />
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={f.includeDemo} onChange={(e) => apply({ includeDemo: e.target.checked })} />
          Include demo
        </label>
        <label className="flex flex-col">
          <span className="text-xs text-slate-500">Sort</span>
          <select value={f.sort} onChange={(e) => apply({ sort: e.target.value })} className="rounded border border-slate-300 px-2 py-1">
            <option value="investmentScore">Investment score</option>
            <option value="cashFlow">Cash flow</option>
            <option value="allInYield">All-in yield</option>
            <option value="dscr">DSCR</option>
            <option value="price">Price (low→high)</option>
            <option value="safety">Neighbourhood safety</option>
          </select>
        </label>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              {sortableHeader("Score", "investmentScore", "px-3")}
              {sortableHeader("Property", "property")}
              {sortableHeader("Price", "price")}
              {sortableHeader("Cash flow", "cashFlow")}
              {sortableHeader("DSCR", "dscr")}
              {sortableHeader("All-in", "allInYield")}
              {sortableHeader("Demand", "demand")}
              {sortableHeader("Transport", "transport")}
              {sortableHeader("Safety", "safety")}
              {sortableHeader("Status", "status")}
              <th className="px-3 py-2"><span className="sr-only">Saved</span></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-sm text-slate-500">
                  No real listings match yet.{" "}
                  <Link href="/import" className="text-blue-600 hover:underline">
                    Import a deal
                  </Link>{" "}
                  or add Melo credits — or tick <b>Include demo</b> above to preview
                  with sample data.
                </td>
              </tr>
            )}
            {visibleItems.map((i) => {
              const w = WHITE_STATUS_META[i.whiteStatus];
              return (
                <tr key={i.id} className="border-b border-slate-100 transition-colors hover:bg-blue-50">
                  <td className="px-3 py-2">
                    <span className="grid h-7 w-7 place-items-center rounded text-xs font-bold text-white" title={`Investment score ${i.investmentScore}/100; safety ${i.safetyScore ?? "not available"}/100 (7% weight)`} style={{ background: scoreColor(i.investmentScore) }}>
                      {i.investmentScore}
                    </span>
                    <span className="ml-2 text-[10px] text-slate-400" title={`Listing source: ${i.source}`}>
                      {i.source === "leboncoin-bulk" ? "Leboncoin" : i.source === "gensdeconfiance-browser" ? "Gens de Confiance" : i.source === "reviewed-public" ? "Reviewed public source" : i.source}
                    </span>
                  </td>
                  <td>
                    <Link href={`/properties/${i.id}`} className="text-blue-600 hover:underline">
                      {i.rooms ?? "?"}P · {i.surface ?? "?"} m² · {i.commune}
                    </Link>
                    <span className="ml-1 text-xs text-slate-400">
                      {i.departement} {i.isDemo ? "· demo" : ""}
                    </span>
                    <span
                      title={SELLER_TYPE_META[(i.sellerType as SellerType) ?? "UNKNOWN"]?.hint}
                      className="ml-2 rounded px-1.5 py-0.5 text-[10px]"
                      style={{
                        color: SELLER_TYPE_META[(i.sellerType as SellerType) ?? "UNKNOWN"]?.color,
                        background: SELLER_TYPE_META[(i.sellerType as SellerType) ?? "UNKNOWN"]?.bg,
                      }}
                    >
                      {SELLER_TYPE_META[(i.sellerType as SellerType) ?? "UNKNOWN"]?.short}
                      {i.sellerName ? ` · ${i.sellerName}` : ""}
                    </span>
                  </td>
                  <td>{euro(i.priceCents)}</td>
                  <td>
                    <span title={cashFlowLabel(i.monthlyCashFlowCents)} className="inline-block rounded px-1.5 py-0.5 font-semibold" style={{ color: cashFlowStyle(i.monthlyCashFlowCents).color, background: cashFlowStyle(i.monthlyCashFlowCents).bg }}>
                      {euroSigned(i.monthlyCashFlowCents)}
                    </span>
                  </td>
                  <td>{i.dscr.toFixed(2)}</td>
                  <td>{pct(i.allInGrossYieldPct)}</td>
                  <td>{i.rentalDemandScore}</td>
                  <td>{i.transportScore}</td>
                  <td>{i.safetyScore ?? "—"}</td>
                  <td>
                    {w && (
                      <span className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: w.bg, color: w.color }}>
                        {w.label}
                      </span>
                    )}
                  </td>
                  <td className="px-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSaved(i.id)}
                      disabled={savingIds.has(i.id)}
                      aria-pressed={savedIds.has(i.id)}
                      aria-label={savedIds.has(i.id) ? `Remove ${i.commune} property from saved` : `Save ${i.commune} property`}
                      title={savedIds.has(i.id) ? "Remove from saved" : "Save property"}
                      className={`rounded p-1 text-xl leading-none transition-colors hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 ${savedIds.has(i.id) ? "text-amber-500" : "text-slate-400"}`}
                    >
                      <span aria-hidden="true">{savedIds.has(i.id) ? "★" : "☆"}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedItems.length > 0 && (
          <div ref={loadMoreRef} className="border-t border-slate-100 px-3 py-3 text-center text-xs text-slate-500">
            Showing {visibleItems.length} of {Math.min(sortedItems.length, MAX_VISIBLE_ROWS)} loaded rows
            {sortedItems.length > MAX_VISIBLE_ROWS ? ` (${sortedItems.length} matches; refine filters to narrow the list)` : ""}
            {canLoadMore && <button type="button" onClick={() => setVisibleCount((count) => Math.min(count + ROW_INCREMENT, rowLimit))} className="ml-2 text-blue-600 hover:underline">Load more</button>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DealsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading…</div>}>
      <DealsInner />
    </Suspense>
  );
}
