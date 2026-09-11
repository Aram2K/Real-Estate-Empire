import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getProperties } from "@/lib/properties/query";
import { z } from "zod";

function owner(): string {
  return process.env.OWNER_ID ?? "local";
}

export async function GET() {
  const saved = await prisma.savedProperty.findMany({
    where: { ownerId: owner() },
    orderBy: { createdAt: "desc" },
    select: { propertyId: true, note: true, createdAt: true },
  });
  const items = saved.length ? await getProperties({ propertyIds: saved.map((s) => s.propertyId), includeDemo: true, limit: saved.length }) : [];
  return NextResponse.json({ saved, items });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = z.object({ propertyId: z.string().min(1), note: z.string().max(10000).nullable().optional() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A property ID and valid note are required" }, { status: 400 });
  }
  const { propertyId, note } = parsed.data;
  if (!await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } })) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  await prisma.savedProperty.upsert({
    where: { ownerId_propertyId: { ownerId: owner(), propertyId } },
    update: { ...(note !== undefined ? { note } : {}) },
    create: { ownerId: owner(), propertyId, note: note ?? null },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const propertyId = req.nextUrl.searchParams.get("propertyId");
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }
  await prisma.savedProperty.deleteMany({ where: { ownerId: owner(), propertyId } });
  return NextResponse.json({ ok: true });
}
