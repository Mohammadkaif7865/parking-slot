import { NextResponse } from "next/server";
import { createOtp } from "../../../../../lib/otp-store";
import { getWhatsappMode, sendOtpMessage } from "../../../../../lib/whatsapp";

export async function POST(request) {
  const body = await request.json();
  const mobile = String(body.mobile || "").trim();

  if (!/^[0-9]{10}$/.test(mobile)) {
    return NextResponse.json({ error: "Enter a valid 10 digit mobile number." }, { status: 400 });
  }

  const otp = createOtp(mobile);
  try {
    const result = await sendOtpMessage(mobile, otp);
    return NextResponse.json({
      mode: getWhatsappMode(),
      sent: result.sent,
      demoOtp: result.mode === "demo" ? otp : undefined,
      message: result.mode === "demo" ? "Demo OTP generated." : "OTP sent on WhatsApp."
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not send OTP." }, { status: 500 });
  }
}

