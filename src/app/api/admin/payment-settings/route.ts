// GET /api/admin/payment-settings — masked Flutterwave status for the dashboard.
// POST /api/admin/payment-settings — save Flutterwave credentials (server-side only,
// never echoed back to the browser; secrets are masked and encrypted at rest).
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getFlutterwaveStatus, saveFlutterwaveSettings, isPlausibleFlutterwaveKey } from "@/lib/payments/flutterwave";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getFlutterwaveStatus();
  return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (body.environment !== undefined && body.environment !== "test" && body.environment !== "live") {
    return NextResponse.json({ error: 'Environment must be "test" or "live".' }, { status: 400 });
  }
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });
  }

  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : undefined;
  if (clientId !== undefined && clientId && !isPlausibleFlutterwaveKey("client_id", clientId)) {
    return NextResponse.json(
      { error: "That doesn't look like a Flutterwave v4 Client ID (a UUID like 9543ec71-…). Copy it from Settings → API Keys." },
      { status: 400 },
    );
  }

  const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret.trim() : undefined;
  if (clientSecret !== undefined && clientSecret && !isPlausibleFlutterwaveKey("client_secret", clientSecret)) {
    return NextResponse.json(
      { error: "That doesn't look like a Flutterwave v4 Client Secret. Copy it from Settings → API Keys." },
      { status: 400 },
    );
  }

  const webhookHash = typeof body.webhookHash === "string" ? body.webhookHash.trim() : undefined;

  await saveFlutterwaveSettings({
    enabled: body.enabled,
    environment: body.environment,
    clientId,
    clientSecret,
    webhookHash,
  });

  const settings = await getFlutterwaveStatus();
  return NextResponse.json({ settings });
}