import { gunzipSync } from "node:zlib";

const UA =
  "IDF-Investment-Radar/0.1 (open-data ingestion; contact: labo.zebrafish@gmail.com)";

async function get(url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`GET ${url} → HTTP ${res.status}`);
  }
  return res;
}

export async function fetchText(url: string): Promise<string> {
  return (await get(url)).text();
}

export async function fetchJson<T = unknown>(url: string): Promise<T> {
  return (await get(url)).json() as Promise<T>;
}

export async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await get(url);
  return Buffer.from(await res.arrayBuffer());
}

/** Fetch a .gz resource and return its decompressed UTF-8 text. */
export async function fetchGzipText(url: string): Promise<string> {
  const buf = await fetchBuffer(url);
  return gunzipSync(buf).toString("utf8");
}
