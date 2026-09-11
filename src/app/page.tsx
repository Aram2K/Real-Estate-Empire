import Link from "next/link";
import { getProperties, type PropertyListItem } from "@/lib/properties/query";
import { euro, euroSigned, pct } from "@/lib/format";
import { scoreColor, WHITE_STATUS_META } from "@/lib/ui/score";

export const dynamic = "force-dynamic";

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function DealRow({ i }: { i: PropertyListItem }) {
  const w = WHITE_STATUS_META[i.whiteStatus];
  return (
    <Link
      href={`/properties/${i.id}`}
      className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 hover:bg-slate-50"
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
        style={{ background: scoreColor(i.investmentScore) }}
      >
        {i.investmentScore}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {i.rooms ?? "?"}P · {i.surface ?? "?"} m² · {i.commune}
          {i.departement ? ` (${i.departement})` : ""}
        </div>
        <div className="text-xs text-slate-500">
          {euro(i.priceCents)} · all-in {pct(i.allInGrossYieldPct)} · DSCR{" "}
          {i.dscr.toFixed(2)}
          {i.distToFutureM != null && i.distToFutureM < 1500
            ? ` · ${Math.round(i.distToFutureM)} m to future ${i.futureName}`
            : ""}
        </div>
      </div>
      <div className="text-right">
        <div
          className="text-sm font-semibold"
          style={{ color: i.monthlyCashFlowCents >= 0 ? "#15803d" : "#b91c1c" }}
        >
          {euroSigned(i.monthlyCashFlowCents)}/mo
        </div>
        {w && (
          <span
            className="rounded px-1.5 py-0.5 text-[11px]"
            style={{ background: w.bg, color: w.color }}
          >
            {w.label}
          </span>
        )}
      </div>
    </Link>
  );
}

function Panel({ title, items }: { title: string; items: PropertyListItem[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="px-3 py-6 text-center text-sm text-slate-400">No matches</div>
      ) : (
        items.map((i) => <DealRow key={i.id} i={i} />)
      )}
    </div>
  );
}

export default async function Dashboard() {
  const all = await getProperties({ includeDemo: false, limit: 3000, sort: "investmentScore" });

  const white = all.filter((i) => i.whiteStatus !== "NOT_WHITE");
  const highYield = [...all].sort((a, b) => b.allInGrossYieldPct - a.allInGrossYieldPct);
  const nearGpe = all
    .filter((i) => i.distToFutureM != null && i.distToFutureM < 900)
    .sort((a, b) => b.investmentScore - a.investmentScore);
  const strongDscr = all.filter((i) => i.dscr >= 1.2 && i.whiteStatus !== "NOT_WHITE");

  const avgCf =
    white.length > 0
      ? Math.round(white.reduce((s, i) => s + i.monthlyCashFlowCents, 0) / white.length)
      : 0;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Financeable, positive-cash-flow opportunities across Île-de-France.
          </p>
        </div>
        <Link
          href="/map"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Open map →
        </Link>
      </div>

      {all.length === 0 ? (
        <div className="card p-8">
          <h2 className="text-lg font-semibold">No real listings yet</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            This app shows <b>real</b> listings only — none are loaded yet. Real
            listings come from one of two legal sources (portal scraping is not
            used):
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="font-semibold">1 · Connect the Melo API</div>
              <p className="mt-1 text-sm text-slate-600">
                Add credits to your Stream.Estate account, then run{" "}
                <code className="rounded bg-slate-100 px-1">npm run ingest:listings</code>
                . Real Île-de-France listings (Leboncoin, SeLoger, Bien&apos;ici,
                …) flow in automatically.
              </p>
              <a
                href="https://stream.estate/console/billing"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-blue-600 hover:underline"
              >
                Add Melo credits ↗
              </a>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="font-semibold">2 · Import a deal you found</div>
              <p className="mt-1 text-sm text-slate-600">
                Found something on a portal or Gens de Confiance? Paste its
                details and the app runs the full analysis and maps it.
              </p>
              <Link
                href="/import"
                className="mt-2 inline-block text-sm text-blue-600 hover:underline"
              >
                Import a listing →
              </Link>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Meanwhile the{" "}
            <Link href="/map" className="text-blue-600 hover:underline">
              map
            </Link>{" "}
            works fully on open data — hotspot scores, prices, rents and Grand
            Paris Express stations across every commune, no listings needed.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="White operations" value={String(white.length)} sub="Rent covers all costs (cash flow ≥ 0)" />
            <Kpi label="9%+ all-in yield" value={String(all.filter((i) => i.allInGrossYieldPct >= 9).length)} sub="On total acquisition cost" />
            <Kpi label="Avg white cash flow" value={`${euroSigned(avgCf)}/mo`} />
            <Kpi label="DSCR ≥ 1.20" value={String(strongDscr.length)} sub="Strong safety margin" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Panel title="Best deals today" items={all.slice(0, 10)} />
            <Panel title="Best white operations" items={white.slice(0, 10)} />
            <Panel title="Highest all-in yield" items={highYield.slice(0, 10)} />
            <Panel title="New Grand Paris opportunities" items={nearGpe.slice(0, 10)} />
            <Panel title="Strongest safety margin (DSCR)" items={[...strongDscr].sort((a, b) => b.dscr - a.dscr).slice(0, 10)} />
            <div className="card p-4 text-sm text-slate-600">
              <div className="mb-2 font-semibold">How to read this</div>
              <p className="mb-2">
                Deals are scored 0–100 on cash flow, all-in yield, rental demand,
                transport catalyst, appreciation, quality and liquidity.
              </p>
              <p className="mb-2">
                A <b>White operation</b> means the tenant covers the mortgage and
                all operating costs. <b>Strong</b> adds ≥ €100/mo cash flow and
                DSCR ≥ 1.20.
              </p>
              <p className="text-xs text-slate-400">
                All figures are estimates, not guaranteed returns.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
