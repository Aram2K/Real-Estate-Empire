/*
 * Paste this entire file into DevTools Console while a Leboncoin search page is
 * open. It harvests a page range without manual navigation and sends batches to
 * the local IDF Investment Radar importer. Adjust CONFIG before running.
 *
 * After it finishes: npm run compute:analyses:new
 */
(async () => {
  const CONFIG = {
    firstPage: 1,
    lastPage: 100,
    concurrency: 4,
    importBatchSize: 400,
    importer: "http://127.0.0.1:3100/api/properties/import-leboncoin-harvest?analyse=false",
  };

  const attr = (ad, key) => (ad.attributes || []).find((item) => item.key === key);
  const number = (value) => {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const normalize = (ad) => ({
    id: String(ad.list_id ?? ad.id),
    url: ad.url,
    ownerType: ad.owner?.type ?? null,
    ownerName: ad.owner?.name ?? null,
    priceCents: number(Array.isArray(ad.price) ? ad.price[0] : ad.price) == null
      ? null
      : Math.round(number(Array.isArray(ad.price) ? ad.price[0] : ad.price) * 100),
    city: ad.location?.city ?? null,
    zipcode: ad.location?.zipcode ?? null,
    lat: number(ad.location?.lat),
    lng: number(ad.location?.lng),
    originType: ad.location?.source ?? null,
    realEstateType: attr(ad, "real_estate_type")?.value == null ? null : String(attr(ad, "real_estate_type").value),
    square: number(attr(ad, "square")?.value),
    rooms: number(attr(ad, "rooms")?.value),
    energy: attr(ad, "energy_rate")?.value == null ? null : String(attr(ad, "energy_rate").value),
    status: ad.status ?? "active",
  });

  const template = new URL(location.href);
  const pages = Array.from(
    { length: CONFIG.lastPage - CONFIG.firstPage + 1 },
    (_, index) => CONFIG.firstPage + index,
  );
  const found = new Map();
  let next = 0;

  async function worker() {
    while (next < pages.length) {
      const page = pages[next++];
      const url = new URL(template);
      url.searchParams.set("page", String(page));
      const html = await fetch(url, { credentials: "include" }).then((response) => {
        if (!response.ok) throw new Error(`Page ${page}: HTTP ${response.status}`);
        return response.text();
      });
      const document = new DOMParser().parseFromString(html, "text/html");
      const json = document.querySelector("#__NEXT_DATA__")?.textContent;
      if (!json) throw new Error(`Page ${page}: __NEXT_DATA__ missing`);
      const ads = JSON.parse(json)?.props?.pageProps?.searchData?.ads ?? [];
      for (const ad of ads) {
        const row = normalize(ad);
        if (row.id && row.id !== "undefined") found.set(row.id, row);
      }
      console.log(`Harvested page ${page}: ${ads.length} adverts (${found.size} distinct)`);
    }
  }

  await Promise.all(Array.from({ length: CONFIG.concurrency }, worker));
  const rows = [...found.values()];
  const totals = { pages: pages.length, harvested: rows.length, created: 0, updated: 0, skipped: 0 };
  for (let start = 0; start < rows.length; start += CONFIG.importBatchSize) {
    const batch = rows.slice(start, start + CONFIG.importBatchSize);
    const response = await fetch(CONFIG.importer, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ads: batch }),
    });
    if (!response.ok) throw new Error(`Importer HTTP ${response.status}: ${await response.text()}`);
    const stats = await response.json();
    totals.created += stats.created;
    totals.updated += stats.updated;
    totals.skipped += stats.skippedNoCommune + stats.skippedOutsideIdf + stats.skippedIncomplete + stats.inactive;
    console.log(`Imported ${Math.min(start + batch.length, rows.length)}/${rows.length}`, stats);
  }
  console.table(totals);
  console.log("Run `npm run compute:analyses:new` in the project terminal.");
  return totals;
})();
