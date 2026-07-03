import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { broadcastRealtime } from "../../../../../lib/realtime";
import { getSlotLevels, normalizeLevel } from "../../../../../lib/parking-levels";

export async function POST(request, { params }) {
  const body = await request.json().catch(() => ({}));
  const mobile = String(body.mobile || "").trim();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.parkingSlot.findUnique({
        where: { id: params.slotId },
        include: { bookings: { where: { status: "active" } } }
      });

      if (!current) {
        throw new Error("Slot not found.");
      }

      const levels = getSlotLevels(current.type);
      const level = normalizeLevel(current.type, body.level);
      const where = levels.length > 1
        ? { slotId: params.slotId, status: "active", level }
        : { slotId: params.slotId, status: "active" };
      const guardedWhere = mobile ? { ...where, mobile } : where;

      const released = await tx.booking.updateMany({
        where: guardedWhere,
        data: { status: "cancelled" }
      });

      if (mobile && released.count === 0) {
        throw new Error("You can release only your active booking.");
      }

      const remainingBookings = levels.length > 1
        ? current.bookings.filter((booking) => normalizeLevel(current.type, booking.level) !== level || (mobile && booking.mobile !== mobile))
        : [];

      const slot = await tx.parkingSlot.update({
        where: { id: params.slotId },
        data: { status: remainingBookings.length >= levels.length ? "booked" : "available" }
      });

      return { slot };
    });

    await broadcastRealtime("slot:released", { mapId: result.slot.mapId, slotId: result.slot.id });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Release failed." }, { status: 400 });
  }
}
