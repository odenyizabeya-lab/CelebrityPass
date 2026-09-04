import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/trust";
import { makeRateLimiter } from "@/lib/secure";

export const dynamic = "force-dynamic";

const contactLimiter = makeRateLimiter(5, 60_000);

const CATEGORIES = new Set([
  "General",
  "Account",
  "Payments",
  "Tickets",
  "Privacy",
  "Security",
  "Other",
]);

export async function POST(request: NextRequest) {
  if (!contactLimiter(clientIp(request))) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const message = String(body.message ?? "").trim();
  const name = String(body.name ?? "").trim() || null;
  const category = String(body.category ?? "General").trim();
  const subject = String(body.subject ?? "").trim() || null;
  const reference = String(body.reference ?? "").trim() || null;

  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }
  if (!message || message.length < 10) {
    return NextResponse.json({ error: "Please write a message of at least 10 characters." }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "Message is too long (4,000 character maximum)." }, { status: 400 });
  }
  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Please choose a valid category." }, { status: 400 });
  }

  const record = await prisma.supportRequest.create({
    data: {
      email,
      name,
      category,
      subject,
      message,
      reference,
      sourceIp: clientIp(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });

  // Best-effort notification to the support team.
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  await import("@/lib/trust").then(({ notifySupport }) =>
    notifySupport(
      `[Support] ${category} — ${name ?? email}`,
      `<p>A new support request was received via the Contact &amp; Support form.</p>
       <p><strong>Category:</strong> ${category}</p>
       <p><strong>From:</strong> ${name ? `${name} &lt;${email}&gt;` : email}</p>
       ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ""}
       ${reference ? `<p><strong>Reference:</strong> ${reference}</p>` : ""}
       <p><strong>Message:</strong></p>
       <p>${escaped}</p>`,
    ),
  );

  return NextResponse.json({ ok: true, id: record.id });
}
