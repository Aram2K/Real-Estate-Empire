/* Run in DevTools on one authenticated Gens de Confiance advert page. */
(() => {
  const match = location.pathname.match(/\/post\/realestate__sale\/([^/?#]+)/i);
  if (!match) throw new Error("Open a Gens de Confiance real-estate sale advert first.");
  const sourceTitle = (document.querySelector("main h1, article h1, h1")?.textContent || "").trim();
  const candidates = [...document.querySelectorAll("main article, main [data-testid*=description], main section, article")]
    .map((element) => (element.innerText || "").trim())
    .filter((text) => text.length >= 40 && text !== sourceTitle)
    .sort((a, b) => b.length - a.length);
  const sourceDescription = candidates[0] || "";
  if (!sourceTitle || !sourceDescription) throw new Error("Could not locate both original title and description; inspect this advert manually.");
  const record = {
    externalId: decodeURIComponent(match[1]).toLowerCase(),
    url: location.href.split(/[?#]/)[0],
    sourceTitle,
    sourceDescription,
  };
  const value = JSON.stringify(record, null, 2);
  if (typeof copy === "function") copy(value);
  else navigator.clipboard.writeText(value);
  console.log("Copied this source review. Save it to a JSON file, then run npm run review:gdc -- --record-file <file>.", record);
  return record;
})();
