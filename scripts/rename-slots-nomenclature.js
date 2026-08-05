const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function getSlotPrefixForParkingLevel(level) {
  const value = Number(level || 1);
  if (value <= 1) return "GLR";
  return `${value - 1}R`;
}

function formatParkingSlotNo(level, number) {
  return `${getSlotPrefixForParkingLevel(level)}${String(number).padStart(3, "0")}`;
}

function parseSlotNumber(slotNo) {
  const match = String(slotNo || "").match(/^(.*?)(\d+)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    number: Number(match[2])
  };
}

function getSlotCapacity(slot) {
  if (String(slot.type || "").includes("3")) return 3;
  if (String(slot.type || "").includes("2")) return 2;
  return 1;
}

function sortSlotsForRename(a, b) {
  const left = parseSlotNumber(a.slotNo);
  const right = parseSlotNumber(b.slotNo);
  if (left && right && left.number !== right.number) return left.number - right.number;
  if (left && !right) return -1;
  if (!left && right) return 1;
  if (a.y !== b.y) return a.y - b.y;
  if (a.x !== b.x) return a.x - b.x;
  return new Date(a.createdAt) - new Date(b.createdAt);
}

async function main() {
  const maps = await prisma.map.findMany({
    orderBy: [{ parkingLevel: "asc" }, { createdAt: "asc" }],
    include: {
      slots: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  const updates = [];
  maps.forEach((map) => {
    let nextNumber = 101;
    [...map.slots].sort(sortSlotsForRename).forEach((slot) => {
      const nextSlotNo = formatParkingSlotNo(map.parkingLevel || 1, nextNumber);
      updates.push({
        id: slot.id,
        map: map.name,
        level: map.parkingLevel || 1,
        from: slot.slotNo,
        to: nextSlotNo
      });
      nextNumber += getSlotCapacity(slot);
    });
  });

  const changed = updates.filter((item) => item.from !== item.to);
  if (!changed.length) {
    console.log("No slot numbers need renaming.");
    return;
  }

  console.log(`Renaming ${changed.length} slots across ${maps.length} maps.`);
  changed.slice(0, 12).forEach((item) => {
    console.log(`${item.map}: ${item.from} -> ${item.to}`);
  });
  if (changed.length > 12) {
    console.log(`...and ${changed.length - 12} more`);
  }

  for (const item of changed) {
    await prisma.parkingSlot.update({
      where: { id: item.id },
      data: { slotNo: `__RENAMING__${item.id}` }
    });
  }

  for (const item of changed) {
    await prisma.parkingSlot.update({
      where: { id: item.id },
      data: { slotNo: item.to }
    });
  }

  console.log("Slot renaming completed.");
}

main()
  .catch((error) => {
    console.error("Slot renaming failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
