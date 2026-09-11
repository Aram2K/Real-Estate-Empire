"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseListingText } from "@/lib/sources/manual/parse";

export default function ImportPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [parsedNote, setParsedNote] = useState<string | null>(null);
  const [form, setForm] = useState({
    address: "",
    priceEuros: "",
    surface: "",
    rooms: "",
    propertyType: "Appartement",
    dpe: "",
    chargesMonthlyEuros: "",
    taxeFonciereAnnualEuros: "",
    url: "",
  });

  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const autofill = () => {
    const p = parseListingText(paste);
    setForm((f) => ({
      ...f,
      priceEuros: p.priceEuros != null ? String(p.priceEuros) : f.priceEuros,
      surface: p.surface != null ? String(p.surface) : f.surface,
      rooms: p.rooms != null ? String(p.rooms) : f.rooms,
      dpe: p.dpe ?? f.dpe,
      propertyType: p.propertyType ?? f.propertyType,
      address: !f.address && p.postcode ? p.postcode : f.address,
    }));
    const found = [
      p.priceEuros != null && "price",
      p.surface != null && "surface",
      p.rooms != null && "rooms",
      p.dpe && "DPE",
      p.postcode && "postcode",
    ].filter(Boolean);
    setParsedNote(
      found.length
        ? `Filled: ${found.join(", ")}. Check the fields below${
            p.postcode ? " and add the street/city for a precise location" : " and add the address"
          }, then Analyze.`
        : "Couldn't detect fields — paste more of the listing text, or fill the form manually."
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      address: form.address,
      priceEuros: Number(form.priceEuros),
      surface: Number(form.surface),
      propertyType: form.propertyType,
    };
    if (form.rooms) body.rooms = Number(form.rooms);
    if (form.dpe) body.dpe = form.dpe;
    if (form.chargesMonthlyEuros) body.chargesMonthlyEuros = Number(form.chargesMonthlyEuros);
    if (form.taxeFonciereAnnualEuros) body.taxeFonciereAnnualEuros = Number(form.taxeFonciereAnnualEuros);
    if (form.url) body.url = form.url;

    try {
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Import failed");
      return;
    }
    router.push(`/properties/${json.id}`);
    } catch {
      setError("Unable to complete the import. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded border border-slate-300 px-2 py-1.5";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-semibold">Import a listing</h1>
      <p className="mt-1 text-sm text-slate-500">
        Found a deal on Leboncoin, SeLoger, Gens de Confiance or anywhere else?
        Copy the listing&apos;s text from the page you&apos;re viewing and paste it
        below — it auto-fills the form. Then the app geocodes it and runs the full
        analysis (yield, cash flow, DSCR, white-operation status, break-even price).
      </p>

      <div className="card mt-4 p-4">
        <label className="text-sm font-medium text-slate-700">
          Quick paste — copy a listing and drop it here
        </label>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={4}
          placeholder="e.g.  €149,500 · Apartment · 32 m² · 3 rooms · 1 bedroom · Garden · 93270 Sevran · DPE D"
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={autofill}
            disabled={!paste.trim()}
            className="rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            Auto-fill from paste
          </button>
          {parsedNote && <span className="text-xs text-slate-500">{parsedNote}</span>}
        </div>
      </div>

      <form onSubmit={submit} className="card mt-4 space-y-3 p-4">
        <label className="block">
          <span className="text-sm text-slate-600">Address (with postcode/city) *</span>
          <input
            required
            className={field}
            placeholder="12 rue de la République, 93270 Sevran"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-sm text-slate-600">Price (€) *</span>
            <input required type="number" className={field} value={form.priceEuros} onChange={(e) => set("priceEuros", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">Surface (m²) *</span>
            <input required type="number" className={field} value={form.surface} onChange={(e) => set("surface", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">Rooms</span>
            <input type="number" className={field} value={form.rooms} onChange={(e) => set("rooms", e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-sm text-slate-600">Type</span>
            <select className={field} value={form.propertyType} onChange={(e) => set("propertyType", e.target.value)}>
              <option>Appartement</option>
              <option>Maison</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">DPE</span>
            <select className={field} value={form.dpe} onChange={(e) => set("dpe", e.target.value)}>
              <option value="">—</option>
              {["A", "B", "C", "D", "E", "F", "G"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">Copro €/mo</span>
            <input type="number" className={field} value={form.chargesMonthlyEuros} onChange={(e) => set("chargesMonthlyEuros", e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-slate-600">Taxe foncière €/yr</span>
            <input type="number" className={field} value={form.taxeFonciereAnnualEuros} onChange={(e) => set("taxeFonciereAnnualEuros", e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">Original listing URL</span>
            <input className={field} value={form.url} onChange={(e) => set("url", e.target.value)} />
          </label>
        </div>

        {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Analyzing…" : "Analyze & save"}
        </button>
      </form>
    </div>
  );
}
