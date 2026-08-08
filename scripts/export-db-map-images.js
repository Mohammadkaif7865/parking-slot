const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const mimeExtensions = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/svg+xml": ".svg"
};

function slugify(value) {
  return String(value || "map")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseDataUrl(value) {
  const match = String(value || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const [, contentType, base64] = match;
  return {
    contentType,
    extension: mimeExtensions[contentType] || ".bin",
    bytes: Buffer.from(base64, "base64")
  };
}

async function main() {
  const maps = await prisma.map.findMany({
    orderBy: [{ parkingLevel: "asc" }, { createdAt: "asc" }]
  });
  const dataMaps = maps.filter((map) => String(map.filePath || "").startsWith("data:"));

  if (!dataMaps.length) {
    console.log("No database map images found to export.");
    return;
  }

  console.log(`Exporting ${dataMaps.length} map image(s) from database to public/uploads/maps.`);

  for (const map of dataMaps) {
    const parsed = parseDataUrl(map.filePath);
    if (!parsed) {
      console.log(`Skipping ${map.id}: invalid data URL`);
      continue;
    }

    const relativeDir = path.join("uploads", "maps", map.locationId);
    const outputDir = path.join(process.cwd(), "public", relativeDir);
    fs.mkdirSync(outputDir, { recursive: true });

    const fileName = `${map.parkingLevel || 1}-${map.id}-${slugify(map.name)}${parsed.extension}`;
    const outputPath = path.join(outputDir, fileName);
    fs.writeFileSync(outputPath, parsed.bytes);

    const publicPath = `/${relativeDir.replace(/\\/g, "/")}/${fileName}`;
    await prisma.map.update({
      where: { id: map.id },
      data: {
        filePath: publicPath,
        sourceType: parsed.extension.replace(".", "")
      }
    });

    console.log(`${map.name}: ${publicPath}`);
  }

  console.log("Map image export completed.");
}

main()
  .catch((error) => {
    console.error("Map image export failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
