import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const users = await prisma.userMaster.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ users });
}

export async function POST(request) {
  const body = await request.json();
  const data = parseUser(body);
  if (!data.name || !data.mobile) {
    return NextResponse.json({ error: "Name and mobile are required." }, { status: 400 });
  }

  try {
    const user = await prisma.userMaster.create({ data });
    return NextResponse.json({ user });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Mobile number already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Could not create user." }, { status: 400 });
  }
}

function parseUser(body) {
  return {
    name: String(body.name || "").trim(),
    mobile: String(body.mobile || "").replace(/\D/g, "").slice(0, 10),
    email: String(body.email || "").trim(),
    address: String(body.address || "").trim(),
    active: body.active !== false
  };
}
