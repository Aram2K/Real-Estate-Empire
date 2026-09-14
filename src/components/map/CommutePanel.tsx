"use client";
import { useEffect, useState } from "react";
import { GeoJSON, CircleMarker, Tooltip, useMap } from "react-leaflet";
import type { LineString } from "geojson";
import type { PropertyListItem } from "@/lib/properties/query";
import { euro } from "@/lib/format";

type Route = { approximate: boolean; distance: number; duration: number; geometry: LineString; destination: { label: string; lat: number; lon: number } };
export default function CommutePanel({ listings, id, setId }: { listings: PropertyListItem[]; id: string; setId: (id: string) => void }) {
  const map = useMap();
  const [destination, setDestination] = useState("Avenue des Champs-Élysées, Paris");
  const [mode, setMode] = useState("driving");
  const [route, setRoute] = useState<Route | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const property = listings.find((l) => l.id === id);
  const approximate = property?.lat == null || property?.lon == null;
  const lat = approximate ? property?.communeLat : property?.lat;
  const lon = approximate ? property?.communeLon : property?.lon;
  useEffect(() => {
    setRoute(null); setError("");
  }, [id, lat, lon, approximate, map]);
  const directions = new URL("https://www.google.com/maps/dir/");
  directions.search = new URLSearchParams({ api: "1", origin: lat != null && lon != null ? `${lat},${lon}` : property?.commune ?? "", destination, travelmode: mode }).toString();
  async function calculate() {
    setBusy(true); setError(""); setRoute(null);
    try {
      const res = await fetch("/api/directions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId: id, destination }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRoute(data);
      map.fitBounds(data.geometry.coordinates.map(([x, y]: number[]) => [y, x]), { paddingTopLeft: [350, 40], paddingBottomRight: [280, 80] });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to calculate route."); }
    finally { setBusy(false); }
  }
  async function saveAddress() {
    setBusy(true); setLocationMessage("");
    try {
      const res = await fetch(`/api/properties/${id}/location`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = `/map?property=${encodeURIComponent(id)}`;
    } catch (e) { setLocationMessage(e instanceof Error ? e.message : "Unable to save address."); }
    finally { setBusy(false); }
  }
  return <>
    {lat != null && lon != null && <CircleMarker center={[lat, lon]} radius={22} pathOptions={{ color: "#f97316", weight: 3, fillOpacity: 0 }}><Tooltip>Selected property{approximate ? " · approximate town centre" : ""}</Tooltip></CircleMarker>}
    {route && <GeoJSON key={JSON.stringify(route.geometry)} data={route.geometry} style={{ color: "#2563eb", weight: 5 }} />}
    {route && <CircleMarker center={[route.destination.lat, route.destination.lon]} radius={9} pathOptions={{ color: "#166534", fillOpacity: 1 }}><Tooltip permanent>Destination</Tooltip></CircleMarker>}
    <div className="absolute left-14 top-3 z-[1000] max-h-[65vh] w-72 overflow-auto rounded-lg border bg-white p-3 text-sm shadow-lg" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <h2 className="font-semibold">Property & commute</h2>
      <label className="mt-2 block">From property<select aria-label="From property" className="mt-1 w-full rounded border p-1" value={id} disabled={busy} onChange={(e) => setId(e.target.value)}><option value="">Select a listing</option>{listings.map((l) => <option key={l.id} value={l.id}>{l.commune} · {l.surface} m² · {euro(l.priceCents)}</option>)}</select></label>
      {property && <><p className="mt-2 text-xs text-slate-600">{approximate ? "Approximate departure: town centre. The exact property address is unknown, so actual commute times will differ." : "Departure uses the stored property coordinates."}</p>
      <label className="mt-2 block">Destination<input className="mt-1 w-full rounded border p-1" value={destination} disabled={busy} onChange={(e) => { setDestination(e.target.value); setRoute(null); }} /></label>
      <label className="mt-2 block">Travel mode<select className="mt-1 w-full rounded border p-1" value={mode} disabled={busy} onChange={(e) => { setMode(e.target.value); setRoute(null); }}><option value="driving">Car</option><option value="transit">Public transport</option><option value="walking">Walking</option><option value="bicycling">Cycling</option></select></label>
      {mode === "driving" ? <button className="mt-3 w-full rounded bg-blue-700 p-2 text-white disabled:opacity-50" disabled={busy || !destination.trim()} onClick={calculate}>{busy ? "Calculating…" : "Calculate route on map"}</button> : <p className="mt-2 text-xs">Open the itinerary below for {mode === "transit" ? "train, metro and bus connections, departure times and transfers" : "mode-specific directions"}.</p>}
      {route && <div className="mt-2 rounded bg-blue-50 p-2"><b>{Math.round(route.duration / 60)} min · {(route.distance / 1000).toFixed(1)} km</b><p className="text-xs">To: {route.destination.label}</p><p className="text-xs">OSRM driving estimate; no live traffic, parking or departure-time adjustment.</p></div>}
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      <a className="mt-3 block font-medium text-blue-700" href={directions.toString()} target="_blank" rel="noreferrer">{mode === "transit" ? "Calculate public transport itinerary" : "Open directions"} in Google Maps ↗</a>
      <details className="mt-3 border-t pt-2"><summary className="cursor-pointer">Add or correct exact address</summary><p className="mt-1 text-xs">Use an address confirmed by the advertiser. Saving updates the map location and transport analysis.</p><label className="mt-2 block">Full property address<input className="mt-1 w-full rounded border p-1" value={address} disabled={busy} onChange={(e) => setAddress(e.target.value)} placeholder="Street number, street, postcode, town" /></label><button className="mt-2 rounded border p-1" disabled={busy || address.trim().length < 5} onClick={saveAddress}>Save address</button>{locationMessage && <p role="alert" className="mt-1 text-xs text-red-700">{locationMessage}</p>}</details>
      </>}
    </div>
  </>;
}
