"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PropertyListItem } from "@/lib/properties/query";
import { euro, euroSigned, pct } from "@/lib/format";
import { scoreColor, WHITE_STATUS_META } from "@/lib/ui/score";

export default function SavedPage() {
  const [items, setItems] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/saved");
      if (!res.ok) throw new Error("Load failed");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setError("Unable to load saved properties. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/saved?propertyId=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Remove failed");
      setItems((s) => s.filter((i) => i.id !== id));
    } catch {
      setError("Unable to remove this property. Please try again.");
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold">Saved properties</h1>
      <p className="mb-4 text-sm text-slate-500">Compare the deals you're tracking.</p>

      {error && <div role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error} <button onClick={load} className="underline">Retry</button></div>}
      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          Nothing saved yet. Open a deal and click <b>☆ Save</b>.
        </div>
      ) : (
        <div className="card overflow-x-auto">
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
                <th></th>
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
                    <td>
                      <button onClick={() => remove(i.id)} className="text-xs text-red-600 hover:underline">
                        Remove
                      </button>
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
