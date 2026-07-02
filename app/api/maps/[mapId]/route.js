import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "../../../../lib/prisma";
import { broadcastRealtime } from "../../../../lib/realtime";

export async function DELETE(_request, { params }) {
  const map = await prisma.map.findUnique({ where: { id: params.mapId } });
  if (!map) {
    return NextResponse.json({ error: "Map not found." }, { status: 404 });
  }

  await prisma.map.delete({ where: { id: params.mapId } });

  await deletePublicMapFile(map.filePath);
  await broadcastRealtime("map:changed", { locationId: map.locationId, mapId: map.id, action: "deleted" });

  return NextResponse.json({ map });
}

async function deletePublicMapFile(filePath) {
  if (!filePath || !filePath.startsWith("/maps/")) {
    return;
  }

  const publicMapsPath = path.join(process.cwd(), "public", "maps");
  const fullPath = path.normalize(path.join(process.cwd(), "public", filePath));

  if (!fullPath.startsWith(publicMapsPath)) {
    return;
  }

  try {
    await unlink(fullPath);
  } catch {
    // The DB record should still be deleted even if the local file is already missing.
  }
}
