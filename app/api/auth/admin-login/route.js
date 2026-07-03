import { NextResponse } from "next/server";

export async function POST(request) {
  const body = await request.json();
  const password = String(body.password || "");
  const expectedPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
  }

  return NextResponse.json({ admin: { role: "admin" } });
}

