import { NextResponse } from "next/server";
import { z } from "zod";
import { HarvestedAdSchema, importHarvestedAds } from "@/lib/sources/leboncoin/harvest";

/**
 * Local harvest sink.
 *
 * A search page posts its own `__NEXT_DATA__` advert payload straight here, so
 * the adverts (and crucially each one's stated `owner.type`) land in the
 * database without round-tripping through a copy-paste step.
 *
 * This is a localhost developer endpoint for a single-user tool: it is
 * unauthenticated like every other route in this app, and it permits
 * cross-origin posts because the caller is a page on another origin. Do not
 * expose this app publicly without adding authentication first — see the
 * hosting note in DEVELOPMENT.md.
 */

const BodySchema = z.union([
  z.array(HarvestedAdSchema),
  z.object({ ads: z.array(HarvestedAdSchema) }),
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid harvest payload", details: parsed.error.flatten() },
      { status: 400, headers: CORS }
    );
  }
  const ads = Array.isArray(parsed.data) ? parsed.data : parsed.data.ads;
  if (ads.length > 500) {
    return NextResponse.json(
      { error: "Batch too large (max 500)" },
      { status: 400, headers: CORS }
    );
  }

  try {
    // Bulk browser sweeps can defer analysis until every page has landed. This
    // avoids recomputing shared market inputs and makes large imports much
    // faster. Run `npm run compute:analyses:new` once after the sweep.
    const analyse = new URL(request.url).searchParams.get("analyse") !== "false";
    const stats = await importHarvestedAds(ads, { analyse });
    return NextResponse.json(stats, { headers: CORS });
  } catch (error) {
    return NextResponse.json(
      { error: "Import failed", detail: String(error) },
      { status: 500, headers: CORS }
    );
  }
}
