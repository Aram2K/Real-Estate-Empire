/**
 * Cheap GeoJSON coordinate rounding + consecutive-dedup, to shrink choropleth
 * payloads without a topology library. 4 dp ≈ 11 m — fine for commune outlines.
 */
type Coord = number[];

function roundNode(node: unknown, dp: number): unknown {
  const f = 10 ** dp;
  if (Array.isArray(node)) {
    if (node.length && typeof node[0] === "number") {
      return (node as number[]).map((n) => Math.round(n * f) / f);
    }
    const mapped = node.map((n) => roundNode(n, dp));
    // ring level: dedup consecutive identical points
    if (mapped.length && Array.isArray(mapped[0]) && typeof (mapped[0] as Coord)[0] === "number") {
      const out: unknown[] = [];
      let prev = "";
      for (const pt of mapped) {
        const k = (pt as Coord).join(",");
        if (k !== prev) {
          out.push(pt);
          prev = k;
        }
      }
      return out.length >= 4 ? out : mapped;
    }
    return mapped;
  }
  return node;
}

export function roundGeometry(geometry: unknown, dp = 4): unknown {
  if (!geometry || typeof geometry !== "object") return geometry;
  const g = geometry as { type: string; coordinates: unknown };
  return { type: g.type, coordinates: roundNode(g.coordinates, dp) };
}
