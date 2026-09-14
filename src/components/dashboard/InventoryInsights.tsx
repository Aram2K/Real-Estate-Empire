"use client";

import { useState } from "react";
import Link from "next/link";
import { ALL, statsKey, type InventorySummary } from "@/lib/dashboard/inventoryStats";

const euro = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

/**
 * Figures are precomputed on the server for every department and source the
 * user can pick (see summarizeInventory), so this component only looks them up
 * instead of receiving and filtering every listing in the browser.
 */
export function InventoryInsights({ summary, activeTotal }: { summary: InventorySummary; activeTotal: number }) {
  const { departments, sources } = summary;
  const [department, setDepartment] = useState(ALL);
  const [source, setSource] = useState(ALL);

  const current = summary.stats[statsKey(department, source)];
  const { sourceCounts, departmentCounts, priceBands } = current;
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
        {(source !== ALL || department !== ALL) && <button className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50" onClick={() => { setSource(ALL); setDepartment(ALL); }}>Reset</button>}
      </div>
    </div>

    <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Active listings" value={(source === ALL && department === ALL ? activeTotal : current.filteredCount).toLocaleString("fr-FR")} />
      <Metric label="Median asking price" value={current.medianPriceCents != null ? euro(current.medianPriceCents) : "—"} />
      <Metric label="Average asking price" value={current.averagePriceCents != null ? euro(current.averagePriceCents) : "—"} />
      <Metric label="Houses / apartments" value={`${current.houses.toLocaleString("fr-FR")} / ${current.apartments.toLocaleString("fr-FR")}`} />
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
