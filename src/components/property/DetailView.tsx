"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PropertyDetail } from "@/lib/properties/detail";
import { euro, euro2, euroSigned, pct, ratio, distance } from "@/lib/format";
import { scoreColor, WHITE_STATUS_META, dscrBandLabel } from "@/lib/ui/score";
import { portalSearchLinks } from "@/lib/ui/portalLinks";

type Overrides = {
  ratePct?: number;
  termYears?: number;
  financingPct?: number;
  rentScenario?: "CONSERVATIVE" | "MARKET";
};

function Tile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="card p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

function Bar({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-medium">{score ?? "No data"}</span>
      </div>
      <div className="h-2 rounded bg-slate-100">
        <div
          className="h-2 rounded"
          style={{ width: `${score ?? 0}%`, background: score == null ? "#cbd5e1" : scoreColor(score) }}
        />
      </div>
    </div>
  );
}

export default function DetailView({ id }: { id: string }) {
  const [d, setD] = useState<PropertyDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ov, setOv] = useState<Overrides>({});

  const load = useCallback(
    async (overrides: Overrides) => {
      setBusy(true);
      setErr(null);
      try {
        const res = Object.keys(overrides).length
          ? await fetch(`/api/properties/${id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(overrides),
            })
          : await fetch(`/api/properties/${id}`);
        if (!res.ok) {
          setErr("Property not found.");
          return;
        }
        setD(await res.json());
      } catch {
        setErr("Unable to load this property. Please refresh and try again.");
      } finally {
        setBusy(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load({});
    fetch("/api/saved")
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => setSaved(data.saved.some((item: { propertyId: string }) => item.propertyId === id)))
      .catch(() => setSaved(false));
  }, [load]);

  const applyOverride = (patch: Overrides) => {
    const next = { ...ov, ...patch };
    setOv(next);
    load(next);
  };

  const save = async () => {
    try {
    const res = await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: id }),
    });
    if (!res.ok) throw new Error("Save failed");
    setSaved(true);
    } catch {
      setErr("Unable to save this property. Please refresh and try again.");
    }
  };

  if (err) return <div className="mx-auto max-w-3xl px-4 py-10 text-slate-500">{err}</div>;
  if (!d) return <div className="mx-auto max-w-3xl px-4 py-10 text-slate-500">Loading…</div>;

  const { property: p, listing: l, analysis: a, dvf, transport, negotiation } = d;
  const fin = a.finance;
  const w = WHITE_STATUS_META[fin.whiteStatus];
  const eb = fin.cashFlow.expenseBreakdown;
  const publicationDate = l.publishedAt ? new Date(l.publishedAt) : null;
  const publicationLabel = publicationDate && !Number.isNaN(publicationDate.getTime())
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(publicationDate)
    : null;

  // Risk flags
  const risks: string[] = [];
  if (p.dpe && ["F", "G"].includes(p.dpe.toUpperCase()))
    risks.push(`Poor energy rating (DPE ${p.dpe}) — possible future rental restriction`);
  if (dvf.discountVsDvfPct != null && dvf.discountVsDvfPct < -5)
    risks.push(`Asking price is above the local DVF median (${pct(-dvf.discountVsDvfPct)} over)`);
  if ((l.daysOnMarket ?? 0) > 90) risks.push("On the market over 90 days");
  if (a.areaScores.rentalDemand < 45) risks.push("Rental demand below regional average");
  if (transport?.future && transport.future.metres < 1500)
    risks.push("Future station opening date is an SGP estimate and may slip");
  if (fin.whiteStatus === "NOT_WHITE") risks.push("Negative cash flow at asking price");

  const suggestLow = fin.breakEven.strongWhiteMaxPriceCents;
  const suggestHigh = fin.breakEven.fullWhiteMaxPriceCents;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <Link href="/properties" className="text-sm text-blue-600">
        ← Back to deals
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {p.rooms ?? "?"}P · {p.surface} m² · {p.commune}
            {p.departement ? ` (${p.departement})` : ""}
          </h1>
          <div className="text-sm text-slate-500">
            {p.addressLine ?? p.commune} · {p.propertyType ?? "—"} · DPE {p.dpe ?? "—"} ·{" "}
            source: {l.source}
            {` · ${l.sellerType === "AGENCY" ? "agency / professional" : l.sellerType === "INDIVIDUAL" ? "private individual" : "seller type unknown"}`}
            {l.sellerName ? ` · ${l.sellerName}` : ""}
            {l.publicationDate ? ` · published ${l.publicationDate} (time not provided)` : publicationLabel ? ` · published ${publicationLabel}` : " · publication date unknown"}
            {` · imported ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/Paris" }).format(new Date(l.firstSeenAt))}`}
            {` · ${p.floor == null ? "Floor unknown" : p.floor === 0 ? "Ground floor" : `Floor ${p.floor}`}`}
            {p.hasElevator != null && ` · ${p.hasElevator ? "with elevator" : "no elevator"}`}
            {p.isDemo && " · demo listing (from DVF)"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            {saved ? "★ Saved" : "☆ Save"}
          </button>
          <Link href={`/map?property=${encodeURIComponent(id)}`} className="rounded border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700">See on map & directions</Link>
          {l.url && (
            <a
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
            >
              Original listing ↗
            </a>
          )}
        </div>
      </div>

      {/* Key tiles */}
      {l.description && (
        <section className="card mt-4 p-4">
          <h2 className="font-semibold">Listing notes</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{l.description}</p>
        </section>
      )}
      {(p.lat == null || p.lon == null) && (
        <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">Exact location unavailable. The map uses an approximate town-centre marker; station distances are unknown and its transport score is incomplete. Add a confirmed address in the map’s commute panel for property-level directions.</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Tile label="Asking price" value={euro(l.priceCents)} />
        <Tile
          label="Monthly cash flow"
          value={`${euroSigned(fin.cashFlow.monthlyCashFlowCents)}`}
          color={fin.cashFlow.monthlyCashFlowCents >= 0 ? "#15803d" : "#b91c1c"}
          sub="pre-tax"
        />
        <Tile
          label="DSCR"
          value={ratio(fin.dscr.dscr)}
          sub={dscrBandLabel(fin.dscr.dscr)}
        />
        <Tile label="All-in yield" value={pct(fin.yields.allInGrossYieldPct)} sub={`gross ${pct(fin.yields.grossYieldPct)}`} />
        <Tile
          label="Investor cash"
          value={euro(fin.financing.investorCashCents)}
          sub={fin.financing.investorCashCents === 0 ? "€0 down" : undefined}
        />
        <Tile
          label="Investment score"
          value={String(a.investmentScore)}
          color={scoreColor(a.investmentScore)}
        />
      </div>

      <div className="mt-3">
        {w && (
          <span
            className="rounded-md px-2 py-1 text-sm font-medium"
            style={{ background: w.bg, color: w.color }}
          >
            {w.label} operation
          </span>
        )}
        {busy && <span className="ml-2 text-xs text-slate-400">recomputing…</span>}
      </div>

      {/* Where to buy / contact */}
      <section className="card mt-4 p-4">
        <h2 className="mb-1 font-semibold">Find it live & contact the seller</h2>
        {l.url ? (
          <>
            <a
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              View the original {l.source} listing & contact seller ↗
            </a>
            <p className="mt-2 text-xs text-slate-500">
              Opens the real advertisement on {l.source}, where you can see photos
              and contact the seller directly.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            {p.isDemo ? (
              <>
                This is a <b>demo deal</b> generated from the DVF median sale price
                for {p.commune} — <b>not a live advertisement</b>, so there is no
                seller to contact directly. Use the searches below to find the
                comparable real listings currently for sale in {p.commune}, view
                them and contact the sellers. When you find one, use{" "}
                <Link href="/import" className="text-blue-600 hover:underline">
                  Import
                </Link>{" "}
                to run this exact analysis on it.
              </>
            ) : (
              <>No source URL was provided for this listing. Search the portals for it below.</>
            )}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {portalSearchLinks({
            commune: p.commune,
            departement: p.departement,
            propertyType: p.propertyType,
          }).map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
            >
              {link.label} ↗
            </a>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          These open each portal&apos;s own search for {p.propertyType === "Maison" ? "houses" : "flats"} for
          sale in {p.commune}. Contacting and buying happens on the portal.
        </p>
      </section>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: finance breakdown */}
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Monthly cash flow</h2>
            <Row label="Estimated rent (market)" value={`${euro2(fin.cashFlow.rentCents)}`} />
            <Row label="Mortgage (incl. insurance)" value={`− ${euro2(fin.mortgage.monthlyTotalCents)}`} />
            <Row label="Non-recoverable copro" value={`− ${euro2(eb.nonRecoverableCoproCents)}`} />
            <Row label="Taxe foncière / 12" value={`− ${euro2(eb.taxeFonciereMonthlyCents)}`} />
            <Row label="Landlord insurance" value={`− ${euro2(eb.landlordInsuranceMonthlyCents)}`} />
            <Row label="Maintenance reserve" value={`− ${euro2(eb.maintenanceReserveCents)}`} />
            <Row label="Vacancy reserve" value={`− ${euro2(eb.vacancyReserveCents)}`} />
            <Row label="Management" value={`− ${euro2(eb.managementCents)}`} />
            <div className="mt-1 border-t border-slate-200 pt-1">
              <Row
                label="Net monthly cash flow"
                value={euroSigned(fin.cashFlow.monthlyCashFlowCents)}
                strong
              />
            </div>
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Acquisition & financing</h2>
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
              <div>
                <Row label="Purchase price" value={euro(fin.acquisition.priceCents)} />
                <Row label={`Notary (${d.assumptions.notaryPct}%)`} value={euro(fin.acquisition.notaryFeesCents)} />
                <Row label="Agency fees" value={euro(fin.acquisition.agencyFeesCents)} />
                <Row label="Guarantee + bank fees" value={euro(fin.acquisition.guaranteeFeesCents + fin.acquisition.bankFeesCents)} />
                <Row label="Renovation + furniture" value={euro(fin.acquisition.renovationCents + fin.acquisition.furnitureCents)} />
                <Row label="Total investment" value={euro(fin.acquisition.totalInvestmentCents)} strong />
              </div>
              <div>
                <Row label={`Loan (${d.assumptions.financingPct}%)`} value={euro(fin.financing.loanPrincipalCents)} />
                <Row label="Investor cash" value={euro(fin.financing.investorCashCents)} strong />
                <Row label={`Rate / term`} value={`${d.assumptions.ratePct}% · ${d.assumptions.termYears}y`} />
                <Row label="Mortgage P&I" value={euro2(fin.mortgage.monthlyPrincipalInterestCents)} />
                <Row label="Borrower insurance" value={euro2(fin.mortgage.monthlyInsuranceCents)} />
                <Row label="Net yield (pre-financing)" value={pct(fin.yields.netYieldBeforeFinancingPct)} />
              </div>
            </div>
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Break-even purchase price</h2>
            <p className="mb-2 text-sm text-slate-500">
              The most you can pay and still keep the operation white, at current
              assumptions.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Max for FULL WHITE" value={suggestHigh != null ? euro(suggestHigh) : "—"} />
              <Tile label="Max for STRONG WHITE" value={suggestLow != null ? euro(suggestLow) : "—"} />
            </div>
            {suggestLow != null && suggestHigh != null && (
              <p className="mt-2 text-sm">
                Suggested negotiation target:{" "}
                <b>
                  {euro(Math.min(suggestLow, suggestHigh))} – {euro(Math.max(suggestLow, suggestHigh))}
                </b>
              </p>
            )}
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Negotiation scenarios</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1">Scenario</th>
                  <th>Price</th>
                  <th>Cash flow</th>
                  <th>DSCR</th>
                  <th>All-in</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {negotiation.map((s) => {
                  const sw = WHITE_STATUS_META[s.whiteStatus];
                  return (
                    <tr key={s.label} className="border-t border-slate-100">
                      <td className="py-1 font-medium">{s.label}</td>
                      <td>{euro(s.priceCents)}</td>
                      <td style={{ color: s.monthlyCashFlowCents >= 0 ? "#15803d" : "#b91c1c" }}>
                        {euroSigned(s.monthlyCashFlowCents)}
                      </td>
                      <td>{ratio(s.dscr)}</td>
                      <td>{pct(s.allInGrossYieldPct)}</td>
                      <td>
                        <span
                          className="rounded px-1.5 py-0.5 text-[11px]"
                          style={{ background: sw?.bg, color: sw?.color }}
                        >
                          {sw?.label ?? s.whiteStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">DVF market comparison</h2>
            <div className="grid grid-cols-3 gap-3">
              <Tile label="Listing €/m²" value={euro(dvf.listingPerM2Cents)} />
              <Tile label="Local DVF median €/m²" value={dvf.dvfMedianPerM2Cents != null ? euro(dvf.dvfMedianPerM2Cents) : "—"} />
              <Tile
                label="Discount vs DVF"
                value={dvf.discountVsDvfPct != null ? pct(dvf.discountVsDvfPct) : "—"}
                color={dvf.discountVsDvfPct != null && dvf.discountVsDvfPct > 0 ? "#15803d" : "#b91c1c"}
              />
            </div>
            {dvf.estimatedMarketValueCents != null && (
              <p className="mt-2 text-sm">
                Estimated market value: <b>{euro(dvf.estimatedMarketValueCents)}</b>{" "}
                (vs asking {euro(l.priceCents)})
              </p>
            )}
            {dvf.comps.length > 0 && (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1">Sold</th>
                    <th>Surface</th>
                    <th>€/m²</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {dvf.comps.map((c, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1">{new Date(c.dateMutation).toLocaleDateString("en-GB")}</td>
                      <td>{Math.round(c.surface)} m²</td>
                      <td>{euro(c.prixM2Cents)}</td>
                      <td>{euro(c.valeurCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        {/* Right: scores, transport, assumptions, risks */}
        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-1 font-semibold">Investment score breakdown</h2>
            <p className="mb-3 text-xs text-slate-500">Neighbourhood safety contributes 7% of the total score when official data is available.</p>
            <Bar label="Cash flow" score={a.scoreParts.cashFlow} />
            <Bar label="All-in yield" score={a.scoreParts.allInGrossYield} />
            <Bar label="Rental demand" score={a.scoreParts.rentalDemand} />
            <Bar label="Transport catalyst" score={a.scoreParts.transportCatalyst} />
            <Bar label="Appreciation (est.)" score={a.scoreParts.appreciation} />
            <Bar label="Property quality" score={a.scoreParts.propertyQuality} />
            <Bar label="Resale liquidity" score={a.scoreParts.resaleLiquidity} />
            <Bar label="Neighbourhood safety · 7%" score={a.scoreParts.safety} />
            <p className="mt-2 text-[11px] text-slate-400">Safety uses official SSMSI recorded-crime rates for the commune, smoothed across 2023–2025. Missing data is excluded from the weighted score.</p>
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Transport</h2>
            {transport?.station && (
              <Row label="Nearest station" value={`${transport.station.name} · ${distance(transport.station.metres)}`} />
            )}
            {transport?.future && (
              <Row
                label={`Future GPE L${transport.future.line}`}
                value={`${transport.future.name} · ${distance(transport.future.metres)}`}
              />
            )}
            {transport?.future && (
              <Row label="Expected opening" value={`${transport.future.openingLabel}`} />
            )}
            {transport?.future?.sourceUrl && (
              <a
                href={transport.future.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-sm text-blue-600 hover:underline"
              >
                Official GPE announcement ↗
              </a>
            )}
            {transport?.hub && (
              <Row label="Nearest employment hub" value={`${transport.hub.name} · ${distance(transport.hub.metres)}`} />
            )}
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Assumptions (what-if)</h2>
            <label className="block text-sm">
              Rate: {d.assumptions.ratePct}%
              <input
                type="range" min={1} max={6} step={0.1}
                defaultValue={d.assumptions.ratePct}
                onMouseUp={(e) => applyOverride({ ratePct: Number((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => applyOverride({ ratePct: Number((e.target as HTMLInputElement).value) })}
                className="w-full"
              />
            </label>
            <div className="mt-2 flex gap-2 text-sm">
              <span className="text-slate-500">Term:</span>
              {[20, 25].map((t) => (
                <button
                  key={t}
                  onClick={() => applyOverride({ termYears: t })}
                  className={`rounded border px-2 py-0.5 ${d.assumptions.termYears === t ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}
                >
                  {t}y
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2 text-sm">
              <span className="text-slate-500">Financing:</span>
              {[100, 110].map((f) => (
                <button
                  key={f}
                  onClick={() => applyOverride({ financingPct: f })}
                  className={`rounded border px-2 py-0.5 ${d.assumptions.financingPct === f ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}
                >
                  {f}%
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2 text-sm">
              <span className="text-slate-500">Rent:</span>
              {(["CONSERVATIVE", "MARKET"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => applyOverride({ rentScenario: r })}
                  className={`rounded border px-2 py-0.5 ${d.assumptions.rentScenario === r ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}
                >
                  {r === "CONSERVATIVE" ? "Conservative" : "Market"}
                </button>
              ))}
            </div>
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Risk flags</h2>
            {risks.length === 0 ? (
              <p className="text-sm text-slate-500">No major risk flags detected.</p>
            ) : (
              <ul className="list-disc pl-5 text-sm text-slate-700">
                {risks.map((r, i) => (
                  <li key={i} className="py-0.5">{r}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        All figures are estimates based on open data (DVF, Carte des Loyers, INSEE,
        Île-de-France Mobilités) and configurable assumptions — not guaranteed
        investment returns. Appreciation is an estimate, not a forecast. Grand Paris
        Express opening dates are SGP estimates and may change.
      </p>
    </div>
  );
}
