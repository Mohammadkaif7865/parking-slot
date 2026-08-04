import { NextResponse } from "next/server";
import { verifyOtp } from "../../../../../lib/otp-store";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request) {
  const body = await request.json();
  const mobile = String(body.mobile || "").replace(/\D/g, "");
  const otp = String(body.otp || "").trim();

  if (!/^[0-9]{10}$/.test(mobile) || !/^[0-9]{6}$/.test(otp)) {
    return NextResponse.json({ error: "Mobile number and 6 digit OTP are required." }, { status: 400 });
  }

  const user = await prisma.userMaster.findUnique({ where: { mobile } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "This mobile number is not registered for parking access." }, { status: 403 });
  }

  if (!verifyOtp(mobile, otp)) {
    return NextResponse.json({ error: "Invalid or expired OTP." }, { status: 400 });
  }

  return NextResponse.json({
    user: {
      role: "user",
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email || "",
      address: user.address || ""
    }
  });
}
