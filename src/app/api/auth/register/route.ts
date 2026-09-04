import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/utils";
import { createFanSession } from "@/lib/auth";
import { clientIp } from "@/lib/trust";
import { makeRateLimiter } from "@/lib/secure";

export const dynamic = "force-dynamic";

const registerLimiter = makeRateLimiter(10, 60_000);

export async function POST(request: NextRequest) {
  if (!registerLimiter(clientIp(request))) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again shortly." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const country = String(body.country ?? "").trim() || null;

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (password.length > 200) {
    return NextResponse.json({ error: "Password is too long." }, { status: 400 });
  }

  const existing = await prisma.fan.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please sign in." },
      { status: 409 },
    );
  }

  const fan = await prisma.fan.create({
    data: {
      name,
      email,
      country,
      password: hashPassword(password),
    },
  });

  await createFanSession(fan.id);

  return NextResponse.json(
    { ok: true, fan: { id: fan.id, name: fan.name, email: fan.email, country: fan.country } },
    { status: 201 },
  );
}
