import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { broadcastRealtime } from "../../../../../lib/realtime";
import { getSlotLevels, normalizeLevel } from "../../../../../lib/parking-levels";

export async function POST(request, { params }) {
  const body = await request.json();
  const allottee = String(body.allottee || "Demo User").trim();
  const mobile = String(body.mobile || "").trim();
  const requestedLevel = String(body.level || "").trim();

  if (mobile && !/^[0-9]{10}$/.test(mobile)) {
    return NextResponse.json({ error: "Mobile number should be 10 digits." }, { status: 400 });
  }

  try {
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

      const levels = getSlotLevels(slot.type);
      const level = normalizeLevel(slot.type, requestedLevel);
      const activeLevels = slot.bookings.map((booking) => normalizeLevel(slot.type, booking.level));

      if (activeLevels.includes(level)) {
        throw new Error(`${slot.slotNo} ${level} level is already booked.`);
      }

      if (activeLevels.length >= levels.length) {
        throw new Error(`${slot.slotNo} is fully booked.`);
      }

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
        data: { status: activeLevels.length + 1 >= levels.length ? "booked" : "available" }
      });

      return { slot: updatedSlot, booking };
    });

    await broadcastRealtime("slot:booked", { mapId: result.slot.mapId, slotId: result.slot.id });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Booking failed." }, { status: 400 });
  }
}
