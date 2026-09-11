"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Polyline,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { GeoJsonObject } from "geojson";
import { euro, euroSigned, pct } from "@/lib/format";
import { cashFlowLabel, cashFlowStyle, scoreColor, WHITE_STATUS_META } from "@/lib/ui/score";
import { SELLER_TYPE_META, type SellerType } from "@/lib/sources/sellerType";
import {
  METRICS,
  getMetric,
  colorForMetric,
  legendFor,
  domainFromFeatures,
  type MetricKey,
} from "@/lib/ui/mapMetrics";
import type { PropertyListItem } from "@/lib/properties/query";
import { groupMapListings } from "@/lib/ui/mapListings";
import { PLANNED_LINES, type PlannedLine } from "@/lib/geo/plannedTransit";
import CommutePanel from "./CommutePanel";

interface StationsData {
  existing: { id: string; nom: string; modes: string; lat: number; lon: number }[];
  future: {
    id: string;
    name: string;
    line: string;
    segment: string | null;
    lat: number;
    lon: number;
    openingLabel: string;
    openingYear: number | null;
    status: string;
    confidence: string;
    sourceUrl: string | null;
  }[];
  hubs: { id: string; name: string; type: string; lat: number; lon: number }[];
  plannedLines?: PlannedLine[];
}

function getLineColor(line: string): string {
  if (line.includes("15")) return "#b91c1c";
  if (line.includes("16")) return "#db2777";
  if (line.includes("17")) return "#65a30d";
  if (line.includes("18")) return "#06b6d4";
  if (line.includes("RER") || line.includes("EOLE")) return "#c026d3";
  if (line.includes("Câble") || line.includes("C1")) return "#0ea5e9";
  if (line.includes("M10")) return "#eab308";
  if (line.includes("M1")) return "#f59e0b";
  if (line.includes("T10")) return "#059669";
  if (line.includes("T1")) return "#14b8a6";
  return "#7c3aed";
}


const IDF_CENTER: [number, number] = [48.8566, 2.3522];

function FitListings({ groups }: { groups: ReturnType<typeof groupMapListings>["groups"] }) {
  const map = useMap();
  useEffect(() => {
    if (groups.length) map.fitBounds(groups.map((g) => [g.lat, g.lon] as [number, number]), { paddingTopLeft: [50, 40], paddingBottomRight: [290, 80], maxZoom: 13 });
  }, [map, groups]);
  return null;
}

function InvalidateSizeFix() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t1 = setTimeout(fix, 100);
    const t2 = setTimeout(fix, 600);
    window.addEventListener("resize", fix);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", fix);
    };
  }, [map]);
  return null;
}

export default function MapView() {
  const [hotspots, setHotspots] = useState<GeoJsonObject | null>(null);
  const [stations, setStations] = useState<StationsData | null>(null);
  const [listings, setListings] = useState<PropertyListItem[]>([]);
  const [metricKey, setMetricKey] = useState<MetricKey>("hotspotScore");
  const [inventoryColors, setInventoryColors] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState({
    hotspots: true,
    listings: true,
    futureMetro: true,
    futureRerAndOther: true,
    existing: false,
    hubs: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/hotspots?segment=APT").then((r) => r.json()),
      fetch("/api/stations").then((r) => r.json()),
      fetch("/api/properties?limit=10000&includeDemo=false").then((r) => r.json()),
    ])
      .then(([h, s, p]) => {
        setHotspots(h);
        setStations(s);
        setListings(p.items ?? []);
      })
      .catch(() => setError("Could not load map data. Please refresh to try again."))
      .finally(() => setLoading(false));
  }, []);

  const cfg = getMetric(metricKey);
  const mapped = useMemo(() => groupMapListings(listings), [listings]);
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of listings) if (item.communeCode) result[item.communeCode] = (result[item.communeCode] ?? 0) + 1;
    return result;
  }, [listings]);

  const domain = useMemo<[number, number]>(() => {
    const features =
      (hotspots as { features?: { properties?: Record<string, number | null> }[] } | null)
        ?.features ?? [];
    return domainFromFeatures(cfg, features);
  }, [hotspots, cfg]);

  const legend = useMemo(() => legendFor(cfg, domain), [cfg, domain]);

  const styleFn = useMemo(
    () =>
      (feature?: { properties?: Record<string, number | null> }) => {
        const count = counts[String(feature?.properties?.code)] ?? 0;
        const color = count > 0 && feature?.properties
          ? inventoryColors ? (count >= 5 ? "#1d4ed8" : count >= 3 ? "#3b82f6" : "#93c5fd") : colorForMetric(cfg, feature.properties, domain)
          : null;
        return {
          fillColor: color ?? "#e2e8f0",
          fillOpacity: color ? 0.45 : 0,
          color: color ? "#64748b" : "#cbd5e1",
          weight: 0.5,
        };
      },
    [cfg, domain, counts, inventoryColors]
  );

  return (
    <div className="relative h-[calc(100vh-3.5rem-2.5rem)] w-full">
      <MapContainer center={IDF_CENTER} zoom={10} className="h-full w-full" preferCanvas>
        <InvalidateSizeFix />
        <FitListings groups={mapped.groups} />
        <CommutePanel listings={listings} />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {show.hotspots && hotspots && (
          <GeoJSON
            key={`${metricKey}:${inventoryColors}:${listings.length}`}
            data={hotspots}
            style={styleFn as never}
            onEachFeature={(feature, layer) => {
              const p = feature.properties as Record<string, number | null> & {
                nom: string;
                code: string;
              };
              layer.bindTooltip(
                `${p.nom}: ${counts[p.code] ?? 0} listings in this app · ${
                  cfg.valueOf(p) != null ? cfg.format(cfg.valueOf(p)!) : "no data"
                }`,
                { sticky: true }
              );
              const yieldPct = p.estGrossYield != null ? (p.estGrossYield * 100).toFixed(1) + "%" : "—";
              const price = p.medianPriceM2 != null ? euro(p.medianPriceM2) + "/m²" : "—";
              const rent = p.medianRentM2 != null ? euro(p.medianRentM2) + "/m²" : "—";
              layer.bindPopup(
                `<div style="min-width:210px">` +
                  `<div style="font-weight:600;font-size:14px">${p.nom} <span style="color:#94a3b8;font-weight:400">(${p.code})</span></div>` +
                  `<div>${counts[p.code] ?? 0} real listings loaded</div><div style="font-size:11px">Market reference data below; not listing averages.</div>` +
                  `<table style="margin:4px 0;font-size:12px;width:100%">` +
                  `<tr><td style="color:#64748b">Median price</td><td style="text-align:right"><b>${price}</b></td></tr>` +
                  `<tr><td style="color:#64748b">Median rent</td><td style="text-align:right">${rent}</td></tr>` +
                  `<tr><td style="color:#64748b">Gross yield</td><td style="text-align:right"><b>${yieldPct}</b></td></tr>` +
                  `<tr><td style="color:#64748b">Hotspot</td><td style="text-align:right">${p.hotspotScore ?? "—"}</td></tr>` +
                  `<tr><td style="color:#64748b">Transport</td><td style="text-align:right">${p.transportScore ?? "—"}</td></tr>` +
                  `<tr><td style="color:#64748b">Demand</td><td style="text-align:right">${p.rentalDemandScore ?? "—"}</td></tr>` +
                  `<tr><td style="color:#64748b">Appreciation</td><td style="text-align:right">${p.appreciationScore ?? "—"}</td></tr>` +
                  `</table>` +
                  `<div style="font-size:11px;color:#94a3b8;margin-bottom:6px">${p.dvfSampleSize ?? 0} DVF sales</div>` +
                  `<a href="/properties?communeCodes=${p.code}" style="color:#2563eb;font-weight:600;font-size:13px">View deals in ${p.nom} →</a>` +
                  `</div>`
              );
            }}
          />
        )}

        {show.listings && mapped.groups.map((group) => (
          <CircleMarker key={group.key} center={[group.lat, group.lon]} radius={group.approximate || group.items.length > 1 ? 15 : 8}
            pathOptions={{ color: group.approximate ? "#1e3a8a" : "#fff", weight: 2, dashArray: group.approximate ? "4 3" : undefined, fillColor: group.approximate ? "#dbeafe" : scoreColor(group.items[0].investmentScore), fillOpacity: 1 }}>
            {(group.approximate || group.items.length > 1) && <Tooltip permanent direction="center" opacity={1} className="listing-count">{group.items.length}</Tooltip>}
            <Popup maxWidth={340}>
              <div style={{ minWidth: 230, maxHeight: 320, overflowY: "auto" }}>
                <b>{group.items[0].commune} · {group.items.length} {group.items.length === 1 ? "property" : "properties"}</b>
                <p style={{ fontSize: 12, color: "#475569" }}>{group.approximate ? "Approximate town-centre marker. Exact addresses are not published; these properties are not all at this point." : `Exact published location · ${group.items[0].addressLine ?? "verified coordinates"}`}</p>
                {group.items.map((l) => <div key={l.id} style={{ borderTop: "1px solid #e2e8f0", padding: "10px 0" }}>
                  <Link href={`/properties/${l.id}`} style={{ color: "#2563eb", fontWeight: 600 }}>{l.propertyType ?? "Property"} · {l.rooms ?? "?"}P · {l.surface ?? "?"} m²</Link>
                  <div><b>{euro(l.priceCents)}</b> · DPE {l.dpe ?? "unknown"}</div>
                  <div style={{ fontSize: 12, marginTop: 3 }}>
                    Estimated cash flow <span title={cashFlowLabel(l.monthlyCashFlowCents)} style={{ display: "inline-block", borderRadius: 4, padding: "1px 5px", fontWeight: 700, ...(() => { const c = cashFlowStyle(l.monthlyCashFlowCents); return { color: c.color, background: c.bg }; })() }}>{euroSigned(l.monthlyCashFlowCents)}/mo</span> · All-in {pct(l.allInGrossYieldPct)}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }} title={SELLER_TYPE_META[(l.sellerType as SellerType) ?? "UNKNOWN"]?.hint}>{SELLER_TYPE_META[(l.sellerType as SellerType) ?? "UNKNOWN"]?.label}{l.sellerName ? ` · ${l.sellerName}` : ""}</div>
                  {l.url && <a href={l.url} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontSize: 12 }}>Original advert ↗</a>}
                </div>)}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Planned Transit Track Alignments (Polylines) */}
        {(stations?.plannedLines ?? PLANNED_LINES).map((line) => {
          const isMetro = line.type === "metro";
          if (isMetro && !show.futureMetro) return null;
          if (!isMetro && !show.futureRerAndOther) return null;

          return (
            <Polyline
              key={line.id}
              positions={line.coords}
              pathOptions={{
                color: line.color,
                weight: 4,
                opacity: 0.85,
                dashArray: line.status === "PLANNED" ? "8 6" : undefined,
              }}
            >
              <Tooltip sticky>
                <b>{line.name}</b> ({line.openingLabel})
              </Tooltip>
              <Popup>
                <div style={{ minWidth: 210 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span
                      style={{
                        background: line.color,
                        color: "#fff",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: "bold",
                      }}
                    >
                      {line.shortName}
                    </span>
                    <b>{line.name}</b>
                  </div>
                  <div>Status: <b>{line.status === "UNDER_CONSTRUCTION" ? "Under Construction" : "Planned"}</b></div>
                  <div>Target opening: <b>{line.openingLabel}</b></div>
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* Planned Stations */}
        {stations?.future.map((s) => {
          const isMetro = !s.line.includes("RER") && !s.line.includes("Câble") && !s.line.includes("T1");
          if (isMetro && !show.futureMetro) return null;
          if (!isMetro && !show.futureRerAndOther) return null;

          const color = getLineColor(s.line);
          return (
            <CircleMarker
              key={`${s.name}-${s.line}`}
              center={[s.lat, s.lon]}
              radius={6.5}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: color,
                fillOpacity: 1,
              }}
            >
              <Tooltip>
                <b>{s.name}</b> ({s.line} · {s.openingLabel})
              </Tooltip>
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span
                      style={{
                        background: color,
                        color: "#fff",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: "bold",
                      }}
                    >
                      {s.line}
                    </span>
                    <b>{s.name}</b>
                  </div>
                  {s.segment && <div style={{ fontSize: 12, color: "#475569" }}>{s.segment}</div>}
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Target opening: <b>{s.openingLabel}</b>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    Status: {s.status === "UNDER_CONSTRUCTION" ? "Under construction" : "Planned extension"}
                  </div>
                  {s.sourceUrl && (
                    <div style={{ marginTop: 6 }}>
                      <a
                        href={s.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#2563eb", fontWeight: 600, fontSize: 12 }}
                      >
                        Official project details ↗
                      </a>
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {show.existing &&
          stations?.existing.map((s) => (
            <CircleMarker
              key={s.id}
              center={[s.lat, s.lon]}
              radius={3}
              pathOptions={{ color: "#334155", weight: 1, fillColor: "#94a3b8", fillOpacity: 0.8 }}
            >
              <Tooltip>{s.nom}</Tooltip>
            </CircleMarker>
          ))}

        {show.hubs &&
          stations?.hubs.map((h) => (
            <CircleMarker
              key={h.id}
              center={[h.lat, h.lon]}
              radius={9}
              pathOptions={{ color: "#1e293b", weight: 2, fillColor: "#facc15", fillOpacity: 0.9 }}
            >
              <Tooltip>{h.name}</Tooltip>
            </CircleMarker>
          ))}
      </MapContainer>

      {/* Right controls column: Control panel + Legend */}
      <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex max-h-[calc(100vh-3.5rem-2.5rem-1.5rem)] w-64 flex-col gap-3 overflow-y-auto">
        {/* Control panel */}
        <div
          className="pointer-events-auto rounded-lg border border-slate-200 bg-white/95 p-3 text-sm shadow-lg backdrop-blur"
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="mb-1 font-semibold">Colour communes by</div>
          <select
            value={inventoryColors ? "inventory" : metricKey}
            onChange={(e) => { setInventoryColors(e.target.value === "inventory"); if (e.target.value !== "inventory") setMetricKey(e.target.value as MetricKey); }}
            className="mb-3 w-full rounded border border-slate-300 px-2 py-1"
          >
            <option value="inventory">Real listings available in app</option>
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <div className="mb-1 font-semibold">Layers</div>
          {(
            [
              ["hotspots", "Commune colouring"],
              ["listings", "Properties for sale"],
              ["futureMetro", "Future Metro (GPE 15-18 & M1/10)"],
              ["futureRerAndOther", "Future RER, Tram & Cable (RER E, C1)"],
              ["existing", "Existing stations (RER / Metro)"],
              ["hubs", "Employment hubs"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={show[key]}
                onChange={(e) => setShow((s) => ({ ...s, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
          <div className="mt-2 border-t pt-2 text-xs text-slate-600">
            {listings.length} real listings · {mapped.groups.length} map locations.
            <p className="mt-1">Numbered circles group listings at the town centre when the exact address is unknown. Click to see every property.</p>
            <p className="mt-1">Uncolored towns have no listings loaded in this app.</p>
            {error && <p role="alert" className="text-red-700">{error}</p>}
            {mapped.unlocated.length > 0 && <div>Location unavailable: {mapped.unlocated.map((l) => <Link className="block text-blue-700" key={l.id} href={`/properties/${l.id}`}>{l.commune} · {euro(l.priceCents)}</Link>)}</div>}
          </div>
          {!loading && listings.length === 0 && (
            <div className="mt-2 rounded bg-amber-50 p-2 text-[11px] text-amber-700">
              No real listings loaded yet. The commune colouring, prices, rents and
              GPE stations below all work on open data. Add listings via{" "}
              <a href="/import" className="underline">
                Import
              </a>{" "}
              or Melo credits.
            </div>
          )}
        </div>

        {/* Legend */}
        <div
          className="pointer-events-auto rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur"
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="mb-1 font-semibold text-slate-700">{inventoryColors ? "Real listings loaded per town" : cfg.label + " · towns with listings only"}</div>
          <div className="h-3 w-full rounded" style={{ background: inventoryColors ? "linear-gradient(to right, #93c5fd, #3b82f6, #1d4ed8)" : legend.gradient }} />
          <div className="mt-0.5 flex justify-between text-slate-500">
            <span>{inventoryColors ? "1–2" : legend.ticks[0]}</span>
            <span>{inventoryColors ? "3–4" : legend.ticks[1]}</span>
            <span>{inventoryColors ? "5+" : legend.ticks[2]}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{inventoryColors ? "Counts reflect our imported adverts, not the whole market. Availability must be confirmed." : legend.note}</div>

          <div className="mt-3 border-t border-slate-200 pt-2">
            <div className="mb-1 font-semibold text-slate-700">Deal markers (investment score)</div>
            <div className="flex items-center gap-1">
              {[40, 50, 60, 70, 80, 90].map((s) => (
                <span key={s} className="flex flex-col items-center">
                  <span
                    className="inline-block h-3 w-3 rounded-full ring-1 ring-white"
                    style={{ background: scoreColor(s) }}
                  />
                  <span className="text-[9px] text-slate-400">{s}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3 border-t border-slate-200 pt-2">
            <div className="mb-1.5 font-semibold text-slate-700">Planned Transit (Mobilité)</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm" style={{ background: "#b91c1c" }} />
                <span>L15 Sud/Ouest/Est</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm" style={{ background: "#db2777" }} />
                <span>L16 (Pleyel-Noisy)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm" style={{ background: "#65a30d" }} />
                <span>L17 (CDG Airport)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm" style={{ background: "#06b6d4" }} />
                <span>L18 (Orly-Versailles)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm" style={{ background: "#c026d3" }} />
                <span>RER E Ouest (EOLE)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm" style={{ background: "#0ea5e9" }} />
                <span>Câble C1</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm" style={{ background: "#f59e0b" }} />
                <span>M1/M10 Extensions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm" style={{ background: "#14b8a6" }} />
                <span>Tram T1/T10</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-3 bg-slate-700" /> Solid = Under construction
              </span>
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-3 border-t-2 border-dashed border-slate-700" /> Dashed = Planned
              </span>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="absolute left-3 top-3 z-[1000] rounded bg-white/95 px-3 py-1.5 text-sm shadow">
          Loading map data…
        </div>
      )}
    </div>
  );
}

