import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/trust";
import { makeRateLimiter } from "@/lib/secure";

export const dynamic = "force-dynamic";

const dataRequestLimiter = makeRateLimiter(6, 60_000);

const TYPES = new Set(["ACCESS", "CORRECTION", "DELETION", "EXPORT"]);

export async function POST(request: NextRequest) {
  if (!dataRequestLimiter(clientIp(request))) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const requestType = String(body.requestType ?? "").toUpperCase();
  const name = String(body.name ?? "").trim() || null;
  const description = String(body.description ?? "").trim() || null;
  const reference = String(body.reference ?? "").trim() || null;

  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }
  if (!TYPES.has(requestType)) {
    return NextResponse.json({ error: "Please choose a valid request type." }, { status: 400 });
  }

  const record = await prisma.dataRequest.create({
    data: {
      email,
      requestType,
      name,
      description,
      reference,
      sourceIp: clientIp(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
  });

  // Best-effort notification to support so the request is actioned.
  await import("@/lib/trust").then(({ notifySupport }) =>
    notifySupport(
      `[Data Request] ${requestType} — ${email}`,
      `<p>A data-subject request was submitted through the User Rights page.</p>
       <p><strong>Type:</strong> ${requestType}</p>
       <p><strong>Email:</strong> ${email}</p>
       ${name ? `<p><strong>Name:</strong> ${name}</p>` : ""}
       ${reference ? `<p><strong>Reference:</strong> ${reference}</p>` : ""}
       ${description ? `<p><strong>Details:</strong> ${String(description)}</p>` : ""}`,
    ),
  );

  return NextResponse.json({ ok: true, id: record.id });
}
