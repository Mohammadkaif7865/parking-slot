import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const locations = await prisma.location.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      maps: {
        orderBy: { createdAt: "asc" },
        include: {
          slots: {
            orderBy: { slotNo: "asc" },
            include: {
              bookings: {
                where: { status: "active" },
                orderBy: { createdAt: "desc" },
                take: 1
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
      maps: location.maps
        .map((map) => ({ ...map, filePath: preferredMapFile(map.filePath) }))
        .map((map) => ({
          id: map.id,
          name: map.name,
          file: map.filePath,
          slots: map.slots.map((slot) => {
            const activeBooking = slot.bookings[0];
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
              level: activeBooking?.level || "",
              allottee: activeBooking?.allottee || "",
              mobile: activeBooking?.mobile || ""
            };
          })
        }))
    }))
  });
}

function preferredMapFile(filePath) {
  return String(filePath || "").replace(
    /^\/maps\/tisha-plaza\/map-([1-5])\.pdf$/i,
    "/maps/tisha-plaza/map-$1.png"
  );
}
