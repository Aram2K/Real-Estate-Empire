"use client";

import { useState } from "react";

export default function BulkImportPage() {
  const [payload, setPayload] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  return <main className="mx-auto max-w-3xl p-8">
    <h1 className="text-2xl font-semibold">Listing batch import</h1>

    <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">Include each advert&apos;s Pro / Particulier badge.</p>
      <p className="mt-1">
        Leboncoin labels every advert with its advertiser kind. That badge is the
        only reliable way to tell an agency sale from a private one, and it is
        what the <b>Advertiser</b> filter on Deals uses. Paste each card&apos;s
        full visible text — the badge sits near the price — and it is recorded
        automatically.
      </p>
      <p className="mt-1">Gens de Confiance cards are also accepted; advertiser type stays unknown unless the source states it explicitly.</p>
      <p className="mt-1">For large authenticated batches, Gens de Confiance fields can be supplied directly, including publication time.</p>
      <p className="mt-1">
        Adverts imported without a badge are stored as <b>Unknown seller</b>
        {" "}rather than assumed professional, so a genuine private sale is never
        hidden behind an agency label.
      </p>
    </div>

    <details className="mt-3 text-sm text-slate-600">
      <summary className="cursor-pointer font-medium">Expected payload shape</summary>
      <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-3 text-xs">{`[
  {
    "url": "https://www.leboncoin.fr/ad/ventes_immobilieres/3219139353",
    "text": "Particulier\\nPrix: 273 000 €\\nAppartement · 2 pièces · 45,5 m²\\nSituée à Saint-Maur-des-Fossés 94100.",
    "dpe": "Classe énergie D",
    "address": "12 rue de Paris, Saint-Maur-des-Fossés"
  },
  {
    "url": "https://gensdeconfiance.com/us/ui/post/realestate__sale/advert-id",
    "price": 425000,
    "propertyType": "Appartement",
    "rooms": 3,
    "surface": 51.5,
    "city": "Boulogne-Billancourt",
    "postalCode": "92100",
    "publishedAt": "2026-09-12T08:30:00+02:00",
    "sellerType": "INDIVIDUAL"
  }
]`}</pre>
      <p className="mt-2">
        <code>address</code> is optional and only used when the advert publishes a
        full street number; it is geocoded and must resolve inside the same
        commune, otherwise the listing keeps an approximate town-centre marker.
      </p>
    </details>

    <textarea
      aria-label="Listing batch"
      placeholder="Paste a JSON array of cards…"
      className="mt-4 h-64 w-full rounded border p-3 font-mono text-xs"
      value={payload}
      onChange={e => setPayload(e.target.value)}
    />

    <button
      className="mt-3 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      disabled={busy || !payload.trim()}
      onClick={async () => {
        setBusy(true);
        setResult("Importing…");
        try {
          const response = await fetch("/api/properties/import-leboncoin-bulk", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: payload,
          });
          const text = await response.text();
          try {
            setResult(JSON.stringify(JSON.parse(text), null, 2));
          } catch {
            setResult(text);
          }
          if (response.ok) setPayload("");
        } catch (error) {
          setResult(`Import failed: ${String(error)}`);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Importing…" : "Import batch"}
    </button>

    <pre aria-live="polite" className="mt-4 whitespace-pre-wrap text-sm">{result}</pre>
  </main>;
}
