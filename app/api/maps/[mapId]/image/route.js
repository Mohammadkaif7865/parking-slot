import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const map = await prisma.map.findUnique({
    where: { id: params.mapId },
    select: { filePath: true }
  });

  if (!map?.filePath) {
    return NextResponse.json({ error: "Map image not found." }, { status: 404 });
  }

  if (!map.filePath.startsWith("data:")) {
    return NextResponse.redirect(new URL(map.filePath, _request.url));
  }

  const match = map.filePath.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid map image data." }, { status: 422 });
  }

  const [, contentType, base64] = match;
  const bytes = Buffer.from(base64, "base64");

  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
