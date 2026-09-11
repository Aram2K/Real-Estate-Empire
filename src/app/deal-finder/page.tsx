"use client";

import { useState } from "react";
import Link from "next/link";
import type { PropertyListItem } from "@/lib/properties/query";
import { IDF_DEPARTMENTS } from "@/lib/constants";
import { euro, euroSigned, pct } from "@/lib/format";
import { scoreColor, WHITE_STATUS_META } from "@/lib/ui/score";

export default function DealFinderPage() {
  const [t, setT] = useState({
    cashFlowMinEuros: "0",
    dscrMin: "1.1",
    rentalDemandMin: "50",
    budgetEuros: "200000",
    maxDistanceToStationM: "",
    maxDistanceToGpeM: "",
  });
  const [departements, setDepartements] = useState<string[]>([]);
  const [items, setItems] = useState<PropertyListItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setT((s) => ({ ...s, [k]: v }));

  const search = async () => {
    setBusy(true);
    const body: Record<string, unknown> = { departements };
    if (t.cashFlowMinEuros) body.cashFlowMinEuros = Number(t.cashFlowMinEuros);
    if (t.dscrMin) body.dscrMin = Number(t.dscrMin);
    if (t.rentalDemandMin) body.rentalDemandMin = Number(t.rentalDemandMin);
    if (t.budgetEuros) body.budgetEuros = Number(t.budgetEuros);
    if (t.maxDistanceToStationM) body.maxDistanceToStationM = Number(t.maxDistanceToStationM);
    if (t.maxDistanceToGpeM) body.maxDistanceToGpeM = Number(t.maxDistanceToGpeM);
    const res = await fetch("/api/deal-finder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setItems(json.items ?? []);
    setBusy(false);
  };

  const field = "w-full rounded border border-slate-300 px-2 py-1.5";

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <h1 className="text-xl font-semibold">Reverse deal finder</h1>
      <p className="mt-1 text-sm text-slate-500">
        State the outcome you want — the app returns only listings that can meet
        every constraint, ranked by investment score.
      </p>

      <div className="card mt-4 grid grid-cols-2 gap-3 p-4 text-sm md:grid-cols-3 lg:grid-cols-6">
        <label className="block">
          <span className="text-xs text-slate-500">Min cash flow €/mo</span>
          <input className={field} type="number" value={t.cashFlowMinEuros} onChange={(e) => set("cashFlowMinEuros", e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Min DSCR</span>
          <input className={field} type="number" step="0.05" value={t.dscrMin} onChange={(e) => set("dscrMin", e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Min rental demand</span>
          <input className={field} type="number" value={t.rentalDemandMin} onChange={(e) => set("rentalDemandMin", e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Max budget €</span>
          <input className={field} type="number" value={t.budgetEuros} onChange={(e) => set("budgetEuros", e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Max walk to station (m)</span>
          <input className={field} type="number" value={t.maxDistanceToStationM} onChange={(e) => set("maxDistanceToStationM", e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Max to future GPE (m)</span>
          <input className={field} type="number" value={t.maxDistanceToGpeM} onChange={(e) => set("maxDistanceToGpeM", e.target.value)} />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Departments:</span>
        {IDF_DEPARTMENTS.map((dp) => (
          <button
            key={dp.code}
            onClick={() =>
              setDepartements((d) =>
                d.includes(dp.code) ? d.filter((x) => x !== dp.code) : [...d, dp.code]
              )
            }
            className={`rounded border px-2 py-0.5 text-xs ${
              departements.includes(dp.code)
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300"
            }`}
          >
            {dp.code}
          </button>
        ))}
        <button
          onClick={search}
          disabled={busy}
          className="ml-auto rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Searching…" : "Find deals"}
        </button>
      </div>

      {items && (
        <div className="card mt-4 overflow-x-auto">
          <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">
            {items.length} matching {items.length === 1 ? "deal" : "deals"}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-3 py-2">Score</th>
                <th>Property</th>
                <th>Price</th>
                <th>Cash flow</th>
                <th>DSCR</th>
                <th>All-in</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const w = WHITE_STATUS_META[i.whiteStatus];
                return (
                  <tr key={i.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <span className="grid h-7 w-7 place-items-center rounded text-xs font-bold text-white" style={{ background: scoreColor(i.investmentScore) }}>
                        {i.investmentScore}
                      </span>
                    </td>
                    <td>
                      <Link href={`/properties/${i.id}`} className="text-blue-600 hover:underline">
                        {i.rooms ?? "?"}P · {i.surface ?? "?"} m² · {i.commune} ({i.departement})
                      </Link>
                    </td>
                    <td>{euro(i.priceCents)}</td>
                    <td style={{ color: i.monthlyCashFlowCents >= 0 ? "#15803d" : "#b91c1c" }}>
                      {euroSigned(i.monthlyCashFlowCents)}
                    </td>
                    <td>{i.dscr.toFixed(2)}</td>
                    <td>{pct(i.allInGrossYieldPct)}</td>
                    <td>
                      {w && (
                        <span className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: w.bg, color: w.color }}>
                          {w.label}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
