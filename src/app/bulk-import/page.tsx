"use client";

import { useState } from "react";

export default function BulkImportPage() {
  const [payload, setPayload] = useState("");
  const [result, setResult] = useState("");
  return <main className="mx-auto max-w-3xl p-8">
    <h1 className="text-2xl font-semibold">Leboncoin batch import</h1>
    <textarea aria-label="Listing batch" className="mt-4 h-64 w-full rounded border p-3 font-mono text-xs" value={payload} onChange={e => setPayload(e.target.value)} />
    <button className="mt-3 rounded bg-black px-4 py-2 text-white" onClick={async () => {
      setResult("Importing…");
      const response = await fetch("/api/properties/import-leboncoin-bulk", { method: "POST", headers: { "content-type": "application/json" }, body: payload });
      setResult(await response.text()); setPayload("");
    }}>Import batch</button>
    <pre aria-live="polite" className="mt-4 whitespace-pre-wrap">{result}</pre>
  </main>;
}
