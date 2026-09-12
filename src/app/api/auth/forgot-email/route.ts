import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Forgot-email recovery: given a name (and optionally the country used at
 * sign-up), reveal a masked version of the matching account's email. Only
 * reveals when exactly one account matches, to avoid leaking account emails.
 */
export async function POST(request: Request) {
  let body: { name?: string; country?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false });
  }

  const name = (body.name ?? "").trim();
  if (name.length < 2) {
    return NextResponse.json({ ok: false });
  }
  const country = (body.country ?? "").trim() || undefined;

  const fans = await prisma.fan.findMany({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(country ? { country: { equals: country, mode: "insensitive" } } : {}),
    },
    select: { email: true },
  });

  if (fans.length !== 1) {
    return NextResponse.json({ ok: false });
  }

  const email = fans[0].email;
  const [local = "", domain = ""] = email.split("@");
  const maskedLocal = local ? `${local.charAt(0)}***` : "***";
  const domainParts = domain.split(".");
  const maskedDomain =
    domainParts.length > 1 ? `${domainParts[0]}.***` : domain || "***";

  return NextResponse.json({
    ok: true,
    maskedEmail: `${maskedLocal}@${maskedDomain}`,
  });
}