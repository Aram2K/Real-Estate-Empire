import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { geocodeAddress } from "@/lib/geo/geocode";
import { computeAndStoreAnalysis } from "@/lib/properties/analyzeOne";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = z.object({ address: z.string().trim().min(5).max(300) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the full address, including street number and town." }, { status: 400 });
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property || property.isDemo) return NextResponse.json({ error: "Property not found." }, { status: 404 });
  try {
    const geo = await geocodeAddress(parsed.data.address);
    if (!geo || geo.type !== "housenumber" || geo.score < 0.7) return NextResponse.json({ error: "Could not match an exact street-number address. Please check the address." }, { status: 422 });
    if (geo.codeCommune !== property.codeCommune) return NextResponse.json({ error: "This address is outside the listing’s town. Please verify it." }, { status: 422 });
    await prisma.property.update({ where: { id }, data: { lat: geo.lat, lon: geo.lon, addressLine: geo.label } });
    await computeAndStoreAnalysis(id);
    return NextResponse.json({ label: geo.label, lat: geo.lat, lon: geo.lon });
  } catch {
    return NextResponse.json({ error: "Unable to save the location. Please try again." }, { status: 503 });
  }
}
