import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { broadcastRealtime } from "../../../../../lib/realtime";

export async function POST(request, { params }) {
  const body = await request.json();
  const slotNo = String(body.slotNo || "").trim();

  if (!slotNo) {
    return NextResponse.json({ error: "Slot number is required." }, { status: 400 });
  }

  const slot = await prisma.parkingSlot.create({
    data: {
      mapId: params.mapId,
      slotNo,
      zone: String(body.zone || ""),
      type: String(body.type || "Regular"),
      x: Number(body.x ?? 10),
      y: Number(body.y ?? 10),
      width: Number(body.width ?? 8),
      height: Number(body.height ?? 6),
      status: String(body.status || "available")
    }
  });

  await broadcastRealtime("slot:changed", { mapId: params.mapId, slotId: slot.id, action: "created" });
  return NextResponse.json({ slot });
}
