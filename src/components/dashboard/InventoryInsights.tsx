"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type InventoryPoint = {
  id: string;
  department: string;
  source: string;
  priceCents: number;
  propertyType: string;
};

const sourceLabel = (source: string) => source.startsWith("leboncoin") ? "Leboncoin" : source.startsWith("gensdeconfiance") ? "Gens de Confiance" : "Other sources";
const euro = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

export function InventoryInsights({ points, activeTotal }: { points: InventoryPoint[]; activeTotal: number }) {
  const departments = [...new Set(points.map((point) => point.department))].sort();
  const sources = [...new Set(points.map((point) => sourceLabel(point.source)))] as string[];
  const [department, setDepartment] = useState("ALL");
  const [source, setSource] = useState("ALL");

  const filtered = useMemo(() => points.filter((point) =>
    (department === "ALL" || point.department === department) &&
    (source === "ALL" || sourceLabel(point.source) === source)
  ), [points, department, source]);

  const priceValues = filtered.map((point) => point.priceCents);
  const sourceCounts = sources.map((name) => ({ name, count: filtered.filter((point) => sourceLabel(point.source) === name).length }));
  const departmentCounts = departments.map((name) => ({ name, count: filtered.filter((point) => point.department === name).length })).sort((a, b) => b.count - a.count);
  const priceBands = [
    { label: "Under €200k", min: 0, max: 20_000_000 },
    { label: "€200–400k", min: 20_000_000, max: 40_000_000 },
    { label: "€400–700k", min: 40_000_000, max: 70_000_000 },
    { label: "€700k–1m", min: 70_000_000, max: 100_000_000 },
    { label: "€1m+", min: 100_000_000, max: Infinity },
  ].map((band) => ({ ...band, count: priceValues.filter((price) => price >= band.min && price < band.max).length }));
  const maxSource = Math.max(1, ...sourceCounts.map((item) => item.count));
  const maxDepartment = Math.max(1, ...departmentCounts.map((item) => item.count));
  const maxBand = Math.max(1, ...priceBands.map((item) => item.count));

  return <section className="mb-6" aria-label="Listing inventory insights">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold">Live listing inventory</h2><p className="text-xs text-slate-500">Filters update every metric and chart below.</p></div>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Filter dashboard by source" className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="ALL">All sources</option>{sources.map((name) => <option key={name}>{name}</option>)}
        </select>
        <select aria-label="Filter dashboard by department" className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" value={department} onChange={(event) => setDepartment(event.target.value)}>
          <option value="ALL">All departments</option>{departments.map((name) => <option key={name}>{name}</option>)}
        </select>
        {(source !== "ALL" || department !== "ALL") && <button className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50" onClick={() => { setSource("ALL"); setDepartment("ALL"); }}>Reset</button>}
      </div>
    </div>

    <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Active listings" value={(source === "ALL" && department === "ALL" ? activeTotal : filtered.length).toLocaleString("fr-FR")} />
      <Metric label="Median asking price" value={priceValues.length ? euro(median(priceValues)) : "—"} />
      <Metric label="Average asking price" value={priceValues.length ? euro(Math.round(priceValues.reduce((sum, value) => sum + value, 0) / priceValues.length)) : "—"} />
      <Metric label="Houses / apartments" value={`${filtered.filter((point) => point.propertyType === "Maison").length.toLocaleString("fr-FR")} / ${filtered.filter((point) => point.propertyType === "Appartement").length.toLocaleString("fr-FR")}`} />
    </div>

    <div className="grid gap-3 lg:grid-cols-3">
      <Chart title="Listings by source">{sourceCounts.map((item) => <Bar key={item.name} label={item.name} count={item.count} max={maxSource} />)}</Chart>
      <Chart title="Asking-price distribution">{priceBands.map((item) => <Bar key={item.label} label={item.label} count={item.count} max={maxBand} />)}</Chart>
      <Chart title="Coverage by department">{departmentCounts.map((item) => <button key={item.name} className="block w-full text-left" onClick={() => setDepartment(item.name)} title={`Filter to department ${item.name}`}><Bar label={item.name} count={item.count} max={maxDepartment} /></button>)}</Chart>
    </div>
    <div className="mt-2 text-right"><Link href="/properties" className="text-sm font-medium text-blue-600 hover:underline">Explore and sort all listings →</Link></div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card p-4"><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>;
}

function Chart({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card p-4"><h3 className="mb-3 text-sm font-semibold">{title}</h3><div className="space-y-2">{children}</div></div>;
}

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  return <div><div className="mb-0.5 flex justify-between text-xs"><span className="truncate pr-2 text-slate-600">{label}</span><b>{count.toLocaleString("fr-FR")}</b></div><div className="h-2 overflow-hidden rounded bg-slate-100"><div className="h-full rounded bg-blue-500" style={{ width: `${count ? Math.max(2, count / max * 100) : 0}%` }} /></div></div>;
}
