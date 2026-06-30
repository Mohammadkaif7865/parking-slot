import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { broadcastRealtime } from "../../../../../lib/realtime";

export async function POST(_request, { params }) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.booking.updateMany({
      where: { slotId: params.slotId, status: "active" },
      data: { status: "cancelled" }
    });

    const slot = await tx.parkingSlot.update({
      where: { id: params.slotId },
      data: { status: "available" }
    });

    return { slot };
  });

  await broadcastRealtime("slot:released", { mapId: result.slot.mapId, slotId: result.slot.id });
  return NextResponse.json(result);
}
