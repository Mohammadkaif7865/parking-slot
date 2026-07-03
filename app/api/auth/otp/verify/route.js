import { NextResponse } from "next/server";
import { verifyOtp } from "../../../../../lib/otp-store";

export async function POST(request) {
  const body = await request.json();
  const mobile = String(body.mobile || "").trim();
  const otp = String(body.otp || "").trim();

  if (!/^[0-9]{10}$/.test(mobile) || !/^[0-9]{6}$/.test(otp)) {
    return NextResponse.json({ error: "Mobile number and 6 digit OTP are required." }, { status: 400 });
  }

  if (!verifyOtp(mobile, otp)) {
    return NextResponse.json({ error: "Invalid or expired OTP." }, { status: 400 });
  }

  return NextResponse.json({ user: { role: "user", mobile } });
}

