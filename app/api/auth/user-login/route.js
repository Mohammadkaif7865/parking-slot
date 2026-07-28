import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(request) {
  const body = await request.json();
  const mobile = String(body.mobile || "").replace(/\D/g, "");

  if (!/^[0-9]{10}$/.test(mobile)) {
    return NextResponse.json({ error: "Enter a valid 10 digit mobile number." }, { status: 400 });
  }

  const user = await prisma.userMaster.findUnique({ where: { mobile } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "This mobile number is not registered for parking access." }, { status: 403 });
  }

  return NextResponse.json({
    user: {
      role: "user",
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      address: user.address || ""
    }
  });
}
