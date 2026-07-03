import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getLevelOccupancy, getOccupancyStatus } from "../../../lib/parking-levels";

export const dynamic = "force-dynamic";

export async function GET() {
  const locations = await prisma.location.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      maps: {
        orderBy: [{ parkingLevel: "asc" }, { createdAt: "asc" }],
        include: {
          slots: {
            orderBy: { slotNo: "asc" },
            include: {
              bookings: {
                where: { status: "active" },
                orderBy: { createdAt: "desc" }
              }
            }
          }
        }
      }
    }
  });

  return NextResponse.json({
    locations: locations.map((location) => ({
      id: location.id,
      name: location.name,
      city: location.city,
      maps: location.maps.map((map) => ({
          id: map.id,
          name: map.name,
          parkingLevel: map.parkingLevel || 1,
          file: map.filePath,
          slots: map.slots.map((slot) => {
          const activeBooking = slot.bookings[0];
          const occupancy = getLevelOccupancy(slot.type, slot.bookings);
          return {
            id: slot.id,
            slotNo: slot.slotNo,
            zone: slot.zone,
            type: slot.type,
            x: slot.x,
            y: slot.y,
            w: slot.width,
            h: slot.height,
            status: slot.status,
            occupancyStatus: getOccupancyStatus(slot.status, slot.type, slot.bookings),
            levels: occupancy.levels,
            bookedLevels: occupancy.bookedLevels,
            availableLevels: occupancy.availableLevels,
              bookings: slot.bookings.map((booking) => ({
                id: booking.id,
                level: booking.level || "",
                allottee: booking.allottee || "",
                mobile: booking.mobile || "",
                createdAt: booking.createdAt
              })),
              level: activeBooking?.level || "",
              allottee: activeBooking?.allottee || "",
              mobile: activeBooking?.mobile || "",
              bookedAt: activeBooking?.createdAt || null
            };
          })
        }))
    }))
  });
}
