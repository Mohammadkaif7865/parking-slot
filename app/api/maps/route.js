import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "../../../lib/prisma";
import { broadcastRealtime } from "../../../lib/realtime";

function slugify(value) {
  return String(value || "map")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request) {
  const formData = await request.formData();
  const locationId = String(formData.get("locationId") || "");
  const name = String(formData.get("name") || "Imported Map");
  const file = formData.get("file");

  if (!locationId || !file || typeof file === "string") {
    return NextResponse.json({ error: "Location and PDF map file are required." }, { status: 400 });
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    return NextResponse.json({ error: "Location not found." }, { status: 404 });
  }

  const extension = path.extname(file.name || "").toLowerCase() || ".pdf";
  if (![".pdf", ".png", ".jpg", ".jpeg", ".svg"].includes(extension)) {
    return NextResponse.json({ error: "Only PDF, image, or SVG maps are supported." }, { status: 400 });
  }

  const folder = path.join(process.cwd(), "public", "maps", locationId);
  await mkdir(folder, { recursive: true });
  const fileName = `${Date.now()}-${slugify(name)}${extension}`;
  const fullPath = path.join(folder, fileName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, bytes);

  const map = await prisma.map.create({
    data: {
      locationId,
      name,
      filePath: `/maps/${locationId}/${fileName}`,
      sourceType: extension.replace(".", "")
    }
  });

  await broadcastRealtime("map:changed", { locationId, mapId: map.id, action: "created" });
  return NextResponse.json({ map });
}
