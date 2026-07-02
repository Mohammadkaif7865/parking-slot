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

  const bytes = Buffer.from(await file.arrayBuffer());
  const sourceType = extension.replace(".", "");
  let filePath;

  if (["png", "jpg", "jpeg", "svg"].includes(sourceType)) {
    filePath = toDataUrl(sourceType, bytes);
  } else {
    const folder = path.join(process.cwd(), "public", "maps", locationId);
    await mkdir(folder, { recursive: true });
    const fileName = `${Date.now()}-${slugify(name)}${extension}`;
    const fullPath = path.join(folder, fileName);
    await writeFile(fullPath, bytes);
    filePath = `/maps/${locationId}/${fileName}`;
  }

  const map = await prisma.map.create({
    data: {
      locationId,
      name,
      filePath,
      sourceType
    }
  });

  await broadcastRealtime("map:changed", { locationId, mapId: map.id, action: "created" });
  return NextResponse.json({ map });
}

function toDataUrl(sourceType, bytes) {
  const mimeTypes = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    svg: "image/svg+xml"
  };

  return `data:${mimeTypes[sourceType]};base64,${bytes.toString("base64")}`;
}
