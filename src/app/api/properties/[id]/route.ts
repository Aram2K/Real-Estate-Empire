import { NextRequest, NextResponse } from "next/server";
import { getPropertyDetail } from "@/lib/properties/detail";
import type { ResolvedAssumptions } from "@/lib/finance/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const detail = await getPropertyDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
}

/** Recompute with per-property assumption overrides (what-if). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const overrides = (await req.json().catch(() => ({}))) as Partial<ResolvedAssumptions>;
  const detail = await getPropertyDetail(id, overrides);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
}
