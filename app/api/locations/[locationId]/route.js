import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { broadcastRealtime } from "../../../../lib/realtime";

export async function PATCH(request, { params }) {
  const body = await request.json();
  const data = {};

  if (body.name !== undefined) data.name = String(body.name || "").trim();
  if (body.parkingName !== undefined) data.parkingName = String(body.parkingName || "").trim();
  if (body.city !== undefined) data.city = String(body.city || "").trim();

  if (data.name === "") {
    return NextResponse.json({ error: "Location name is required." }, { status: 400 });
  }

  const location = await prisma.location.update({
    where: { id: params.locationId },
    data
  });

  await broadcastRealtime("map:changed", { locationId: location.id, action: "location-updated" });
  return NextResponse.json({ location });
}
