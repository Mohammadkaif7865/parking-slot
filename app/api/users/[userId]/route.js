import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function PATCH(request, { params }) {
  const body = await request.json();
  const data = {};

  if (body.name !== undefined) data.name = String(body.name || "").trim();
  if (body.mobile !== undefined) data.mobile = String(body.mobile || "").replace(/\D/g, "").slice(0, 10);
  if (body.address !== undefined) data.address = String(body.address || "").trim();
  if (body.active !== undefined) data.active = Boolean(body.active);

  if (data.name === "" || data.mobile === "") {
    return NextResponse.json({ error: "Name and mobile are required." }, { status: 400 });
  }

  try {
    const user = await prisma.userMaster.update({ where: { id: params.userId }, data });
    return NextResponse.json({ user });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Mobile number already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Could not update user." }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  const activeBooking = await prisma.booking.findFirst({
    where: { userId: params.userId, status: "active" }
  });

  if (activeBooking) {
    return NextResponse.json({ error: "Deactivate this user instead. Active booking exists." }, { status: 400 });
  }

  const user = await prisma.userMaster.delete({ where: { id: params.userId } });
  return NextResponse.json({ user });
}
