import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { geocodeAddress } from "@/lib/geo/geocode";

const input = z.object({ propertyId: z.string().min(1), destination: z.string().trim().min(3).max(300) });
export async function POST(req: NextRequest) {
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select a property and enter a destination." }, { status: 400 });
  const p = await prisma.property.findUnique({ where: { id: parsed.data.propertyId }, include: { commune: true } });
  if (!p || p.isDemo) return NextResponse.json({ error: "Property not found." }, { status: 404 });
  const approximate = p.lat == null || p.lon == null;
  const lat = approximate ? p.commune?.lat : p.lat;
  const lon = approximate ? p.commune?.lon : p.lon;
  if (lat == null || lon == null) return NextResponse.json({ error: "This property needs a location first." }, { status: 422 });
  try {
    const destination = await geocodeAddress(parsed.data.destination);
    if (!destination || destination.score < 0.4) return NextResponse.json({ error: "Destination not found. Add a city or postcode." }, { status: 422 });
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${lon},${lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&steps=false`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Routing unavailable");
    const data = await response.json();
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route) return NextResponse.json({ error: "No driving route found." }, { status: 422 });
    return NextResponse.json({ approximate, destination, origin: { lat, lon }, distance: route.distance, duration: route.duration, geometry: route.geometry });
  } catch {
    return NextResponse.json({ error: "Route service unavailable. Use the Google Maps directions link below." }, { status: 503 });
  }
}
