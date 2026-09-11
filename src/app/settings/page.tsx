import { DEFAULT_ASSUMPTIONS } from "@/lib/assumptions/defaults";
import { euro } from "@/lib/format";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [real, demo, communes, sales, rents, latest] = await Promise.all([
    prisma.property.count({ where: { isDemo: false } }),
    prisma.property.count({ where: { isDemo: true } }),
    prisma.commune.count(),
    prisma.saleComparable.count(),
    prisma.rentReference.count(),
    prisma.investmentAnalysis.aggregate({ _max: { computedAt: true } }),
  ]);
  const a = DEFAULT_ASSUMPTIONS;
  const rows: [string, string][] = [
    ["Mortgage rate", `${a.ratePct}%`],
    ["Loan term", `${a.termYears} years`],
    ["Financing", `${a.financingPct}% of price`],
    ["Borrower insurance", `${a.insurancePct}% / yr of principal`],
    ["Notary fees", `${a.notaryPct}% of price`],
    ["Agency fees", `${a.agencyPct}% of price`],
    ["Bank fees", euro(a.bankFeesCents)],
    ["Vacancy reserve", `${a.vacancyPct}% of rent`],
    ["Maintenance reserve", `${a.maintenancePct}% of rent`],
    ["Management", `${a.managementPct}% of rent`],
    ["Rent scenario", a.rentScenario === "MARKET" ? "Market (median)" : "Conservative"],
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-semibold">Data & settings</h1>
      <section className="card my-4 p-4" aria-label="Data coverage">
        <h2 className="font-semibold">What is loaded</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          {[
            ["Real properties", real], ["Demo properties", demo],
            ["Communes", communes], ["Sale comparables", sales], ["Rent references", rents],
          ].map(([label, count]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="font-semibold">{Number(count).toLocaleString("en-GB")}</dd></div>)}
        </dl>
        <p className="mt-3 text-xs text-slate-500">Latest analysis: {latest._max.computedAt?.toISOString().slice(0, 10) ?? "Not calculated yet"}. This is the calculation date, not the date of the underlying market data.</p>
        <p className="mt-2 text-sm text-slate-600">Licensed listing API: {process.env.MELO_API_KEY ? "Key configured; connection and account credits still need verification." : "Not configured. Import listings manually to analyze real opportunities."}</p>
      </section>
      <h2 className="text-xl font-semibold">Default assumptions</h2>
      <p className="mt-1 text-sm text-slate-500">
        Every deal is analyzed with these defaults. You can override any of them
        per-property using the <b>what-if</b> panel on a deal's page (rate, term,
        financing, rent scenario) and the numbers recompute instantly.
      </p>

      <div className="card mt-4 divide-y divide-slate-100 p-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between px-2 py-2 text-sm">
            <span className="text-slate-500">{k}</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        These reflect the target strategy: little or no money down (110% financing),
        25-year term, rent covering the mortgage and all operating costs, with a
        safety margin (DSCR ≥ 1.20 where possible). All outputs are estimates, not
        guaranteed returns. To change the global defaults permanently, edit
        <code className="mx-1 rounded bg-slate-100 px-1">src/lib/assumptions/defaults.ts</code>
        and re-run <code className="rounded bg-slate-100 px-1">npm run compute:analyses</code>.
      </p>
    </div>
  );
}
