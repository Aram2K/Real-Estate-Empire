/*
 * Paste this entire file into DevTools Console while a Leboncoin search page is
 * open. It harvests non-overlapping search segments without manual navigation
 * and sends batches to the local IDF Investment Radar importer. Adjust CONFIG
 * before running. Leboncoin caps a search at 100 pages, so price segmentation is
 * essential for broad coverage.
 *
 * After it finishes: npm run compute:analyses:new
 */
(async () => {
  const CONFIG = {
    concurrency: 4,
    importBatchSize: 400,
    importer: "http://127.0.0.1:3100/api/properties/import-leboncoin-harvest?analyse=false",
    // Disjoint defaults aimed at the part of the current database with the
    // least coverage. Each price interval is inclusive and does not overlap
    // its neighbour. Add the lower bands only after these finish.
    priceBands: [
      "150000-199999", "200000-249999", "250000-299999",
      "300000-399999", "400000-499999", "500000-749999",
      "750000-999999", "1000000-1999999", "2000000-4999999",
      "5000000-20000000",
    ],
    ownerTypes: ["pro", "private"],
    maxPagesPerSegment: 100,
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
    title: ad.subject ?? null,
    description: ad.body ?? null,
    publishedAt: ad.first_publication_date ?? ad.index_date ?? null,
  });

  const template = new URL(location.href);
  template.searchParams.set("category", "9");
  template.searchParams.set("locations", "r_12");
  template.searchParams.set("real_estate_type", "2,1");
  template.searchParams.set("immo_sell_type", "old");
  template.searchParams.set("sort", "time");
  template.searchParams.set("order", "desc");

  async function readPage(segment, page) {
    const url = new URL(template);
    url.searchParams.set("price", segment.price);
    url.searchParams.set("owner_type", segment.ownerType);
    url.searchParams.set("page", String(page));
    const html = await fetch(url, { credentials: "include" }).then((response) => {
      if (!response.ok) throw new Error(`${segment.key} page ${page}: HTTP ${response.status}`);
      return response.text();
    });
    const document = new DOMParser().parseFromString(html, "text/html");
    const json = document.querySelector("#__NEXT_DATA__")?.textContent;
    if (!json) throw new Error(`${segment.key} page ${page}: __NEXT_DATA__ missing`);
    return JSON.parse(json)?.props?.pageProps?.searchData ?? {};
  }

  async function importRows(rows, totals) {
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
    totals.skipped += stats.skippedNoCommune + stats.skippedOutsideIdf + stats.skippedIncomplete + (stats.skippedSuspicious ?? 0) + stats.inactive;
      console.log(`Imported ${Math.min(start + batch.length, rows.length)}/${rows.length}`, stats);
    }
  }

  const segments = CONFIG.priceBands.flatMap((price) =>
    CONFIG.ownerTypes.map((ownerType) => ({ key: `${ownerType}:${price}`, price, ownerType })),
  );
  const totals = { segments: segments.length, pages: 0, harvested: 0, created: 0, updated: 0, skipped: 0 };

  for (const segment of segments) {
    const found = new Map();
    const first = await readPage(segment, 1);
    for (const ad of first.ads ?? []) {
      const row = normalize(ad);
      if (row.id && row.id !== "undefined") found.set(row.id, row);
    }
    const pageCount = Math.min(
      CONFIG.maxPagesPerSegment,
      Number(first.max_pages ?? first.maxPages ?? 1) || 1,
    );
    const pages = Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => index + 2);
    let next = 0;
    async function worker() {
      while (next < pages.length) {
        const page = pages[next++];
        const data = await readPage(segment, page);
        for (const ad of data.ads ?? []) {
          const row = normalize(ad);
          if (row.id && row.id !== "undefined") found.set(row.id, row);
        }
        console.log(`${segment.key} page ${page}/${pageCount}: ${found.size} distinct`);
      }
    }
    await Promise.all(Array.from({ length: CONFIG.concurrency }, worker));
    const rows = [...found.values()];
    totals.pages += pageCount;
    totals.harvested += rows.length;
    await importRows(rows, totals);
    console.log(`Completed ${segment.key}`, { pages: pageCount, harvested: rows.length });
  }
  console.table(totals);
  console.log("Run `npm run compute:analyses:new` in the project terminal.");
  return totals;
})();
