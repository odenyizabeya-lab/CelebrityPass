import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/utils";
import { createFanSession } from "@/lib/auth";
import { makeRateLimiter } from "@/lib/secure";

export const dynamic = "force-dynamic";

const fanLoginLimiter = makeRateLimiter(20, 60_000);

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  if (!fanLoginLimiter(clientIp(request))) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  const fan = await prisma.fan.findUnique({ where: { email } });
  if (!fan || !fan.password || !verifyPassword(password, fan.password)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  if (!fan.isActive) {
    return NextResponse.json({ error: "This account has been suspended" }, { status: 403 });
  }
  await createFanSession(fan.id);
  return NextResponse.json({
    fan: { id: fan.id, name: fan.name, email: fan.email, country: fan.country },
  });
}