const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const maps = [
  ["Map 1", "/maps/tisha-plaza/map-1.pdf", "A", "Wing A"],
  ["Map 2", "/maps/tisha-plaza/map-2.pdf", "B", "Wing B"],
  ["Map 3", "/maps/tisha-plaza/map-3.pdf", "C", "Zone C"],
  ["Map 4", "/maps/tisha-plaza/map-4.pdf", "D", "Zone D"],
  ["Map 5", "/maps/tisha-plaza/map-5.pdf", "E", "Stack Area"]
];

function demoSlots(prefix, zone) {
  return [
    { slotNo: `${prefix}-101`, zone, type: "Regular", x: 12, y: 16, width: 9, height: 7, status: "available" },
    { slotNo: `${prefix}-102`, zone, type: "Regular", x: 24, y: 16, width: 9, height: 7, status: "available" },
    { slotNo: `${prefix}-103`, zone, type: "Stack 2-tier", x: 36, y: 16, width: 9, height: 7, status: "reserved" },
    { slotNo: `${prefix}-104`, zone, type: "Regular", x: 48, y: 16, width: 9, height: 7, status: "available" },
    { slotNo: `${prefix}-201`, zone: `${zone} Visitor`, type: "Stack 3-tier", x: 18, y: 38, width: 9, height: 7, status: "available" },
    { slotNo: `${prefix}-202`, zone: `${zone} Visitor`, type: "Regular", x: 30, y: 38, width: 9, height: 7, status: "available" },
    { slotNo: `${prefix}-203`, zone: `${zone} Visitor`, type: "Regular", x: 42, y: 38, width: 9, height: 7, status: "available" },
    { slotNo: `${prefix}-204`, zone: `${zone} Visitor`, type: "Stack 2-tier", x: 54, y: 38, width: 9, height: 7, status: "available" }
  ];
}

async function main() {
  const location = await prisma.location.upsert({
    where: { id: "tisha-plaza" },
    update: { name: "Tisha Plaza Parking", city: "Mumbai" },
    create: { id: "tisha-plaza", name: "Tisha Plaza Parking", city: "Mumbai" }
  });

  for (const [index, [name, filePath, prefix, zone]] of maps.entries()) {
    const map = await prisma.map.upsert({
      where: { id: `tisha-map-${index + 1}` },
      update: { name, filePath, sourceType: "pdf", locationId: location.id },
      create: { id: `tisha-map-${index + 1}`, name, filePath, sourceType: "pdf", locationId: location.id }
    });

    for (const slot of demoSlots(prefix, zone)) {
      await prisma.parkingSlot.upsert({
        where: { mapId_slotNo: { mapId: map.id, slotNo: slot.slotNo } },
        update: slot,
        create: { ...slot, mapId: map.id }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
