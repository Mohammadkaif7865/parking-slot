import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { broadcastRealtime } from "../../../../../lib/realtime";

export async function POST(request, { params }) {
  const body = await request.json();
  const allottee = String(body.allottee || "Demo User").trim();
  const mobile = String(body.mobile || "").trim();
  const level = String(body.level || "").trim();

  if (mobile && !/^[0-9]{10}$/.test(mobile)) {
    return NextResponse.json({ error: "Mobile number should be 10 digits." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const slot = await tx.parkingSlot.findUnique({
      where: { id: params.slotId },
      include: { bookings: { where: { status: "active" } } }
    });

    if (!slot) {
      throw new Error("Slot not found.");
    }

    if (slot.status === "reserved" || slot.status === "maintenance") {
      throw new Error(`Slot is ${slot.status}.`);
    }

    await tx.booking.updateMany({
      where: { slotId: slot.id, status: "active" },
      data: { status: "cancelled" }
    });

    const booking = await tx.booking.create({
      data: {
        slotId: slot.id,
        allottee,
        mobile,
        level
      }
    });

    const updatedSlot = await tx.parkingSlot.update({
      where: { id: slot.id },
      data: { status: "booked" }
    });

    return { slot: updatedSlot, booking };
  });

  await broadcastRealtime("slot:booked", { mapId: result.slot.mapId, slotId: result.slot.id });
  return NextResponse.json(result);
}
