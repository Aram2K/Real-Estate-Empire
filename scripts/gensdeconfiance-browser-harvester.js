/*
 * Run in DevTools on an authenticated Gens de Confiance real-estate sale
 * results page. It scrolls the SPA, extracts only complete IDF sale cards, and
 * copies the importer-ready JSON array. Paste it into /bulk-import.
 *
 * This intentionally reads rendered adverts rather than calling an undocumented
 * private API. It therefore keeps the user's authenticated session in-browser
 * and remains resilient when the site's transport layer changes.
 */
(async () => {
  const CONFIG = { maxScrollRounds: 250, settledRounds: 10, scrollDelayMs: 900 };
  const COLLECTION_DEPARTMENTS = ["76", "45", "51", "80", "10", "27", "28", "60", "89", "72", "14", "37"];
  const COLLECTION_POSTAL = new RegExp(`\\b((?:${COLLECTION_DEPARTMENTS.filter((department) => department !== "75").join("|")})\\d{3})\\b`);
  const links = new Map();
  let unchanged = 0;

  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const canonical = (href) => {
    const url = new URL(href, location.origin);
    const match = url.pathname.match(/\/post\/realestate__sale\/([^/?#]+)/i);
    return match
      ? `https://gensdeconfiance.com/us/ui/post/realestate__sale/${encodeURIComponent(decodeURIComponent(match[1]).toLowerCase())}`
      : null;
  };
  const cardFor = (anchor) => {
    let node = anchor;
    let best = anchor;
    for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
      const value = (node.innerText || "").trim();
      if (value.length >= 35 && value.length <= 2_500) best = node;
      if (node.matches?.("article, li, [role=listitem]")) break;
    }
    return best;
  };
  const observe = () => {
    for (const anchor of document.querySelectorAll('a[href*="/post/realestate__sale/"]')) {
      const url = canonical(anchor.href);
      if (!url) continue;
      const card = cardFor(anchor);
      const text = (card.innerText || "").replace(/\u00a0|\u202f/g, " ").trim();
      const title = (card.querySelector("h1, h2, h3, [role=heading]")?.textContent || anchor.getAttribute("aria-label") || "").trim();
      const postalCode = text.match(COLLECTION_POSTAL)?.[1];
      if (!postalCode || !/\b(appartement|apartment)\b/i.test(text) || !/\b\d+[,.]?\d*\s*m[²2]\b/i.test(text) || !/[€]\s*[\d ]+|[\d ]+\s*€/i.test(text)) continue;
      const time = card.querySelector("time")?.dateTime || card.querySelector("time")?.getAttribute("datetime") || undefined;
      links.set(url, { url, text, ...(title ? { title } : {}), ...(time ? { publishedAt: time } : {}) });
    }
  };

  for (let round = 0; round < CONFIG.maxScrollRounds && unchanged < CONFIG.settledRounds; round++) {
    const before = links.size;
    observe();
    const more = [...document.querySelectorAll("button")].find((button) => /voir plus|charger plus|show more|load more/i.test(button.innerText || ""));
    if (more && !more.disabled) more.click();
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    await sleep(CONFIG.scrollDelayMs);
    observe();
    unchanged = links.size === before ? unchanged + 1 : 0;
    console.log(`GDC scan ${round + 1}: ${links.size} complete distinct IDF adverts`);
  }

  const rows = [...links.values()].sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? "") || 0);
  const payload = JSON.stringify(rows);
  if (typeof copy === "function") copy(payload);
  else await navigator.clipboard.writeText(payload);
  console.log(`Copied ${rows.length} complete distinct GDC adverts. Paste into http://127.0.0.1:3100/bulk-import`);
  return rows;
})();
