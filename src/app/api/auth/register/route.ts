import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/utils";
import { createFanSession } from "@/lib/auth";
import { clientIp } from "@/lib/trust";
import { makeRateLimiter } from "@/lib/secure";
import { sendRegistrationEmails } from "@/lib/emails/senders";
import { isSelectableCountry, normalizeCountry } from "@/lib/countries";

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
  const countryInput = String(body.country ?? "").trim();

  // Field validation happens before any database work, so a malformed request
  // is rejected without touching Postgres.
  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (name.length > 120) {
    return NextResponse.json({ error: "Please enter a shorter name." }, { status: 400 });
  }
  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }
  if (email.length > 254) {
    return NextResponse.json({ error: "Please enter a shorter email address." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (password.length > 200) {
    return NextResponse.json({ error: "Password is too long." }, { status: 400 });
  }

  // Country must be one of the countries the platform actually recognises.
  // The client sends a canonical name from the picker; normalising here means a
  // hand-crafted request using a known alias ("USA") is still accepted, while
  // free text and typos are not. A country is required: the picker makes this
  // impossible to skip, and the API enforces it.
  if (!countryInput) {
    return NextResponse.json({ error: "Please select your country." }, { status: 400 });
  }
  if (!isSelectableCountry(countryInput)) {
    return NextResponse.json({ error: "Please select a valid country from the list." }, { status: 400 });
  }
  const country = normalizeCountry(countryInput) ?? countryInput;

  let existing;
  try {
    existing = await prisma.fan.findUnique({ where: { email } });
  } catch {
    return NextResponse.json(
      { error: "We couldn't reach our servers. Please try again in a moment." },
      { status: 503 },
    );
  }
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please sign in." },
      { status: 409 },
    );
  }

  let fan;
  try {
    fan = await prisma.fan.create({
      data: {
        name,
        email,
        country,
        password: hashPassword(password),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "We couldn't create your account. Please try again." },
      { status: 503 },
    );
  }

  // Welcome + email-verification burst. Expected to succeed, but a broken
  // email provider must never fail the registration itself.
  try {
    await sendRegistrationEmails(fan);
  } catch (err) {
    console.error("[email] Registration email burst failed:", err);
  }

  await createFanSession(fan.id);

  return NextResponse.json(
    { ok: true, fan: { id: fan.id, name: fan.name, email: fan.email, country: fan.country } },
    { status: 201 },
  );
}
