import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { hasTicketmasterApiKey, setTicketmasterApiKey } from "@/lib/events/sources/ticketing-settings";

export const dynamic = "force-dynamic";

// GET /api/admin/ticketing-settings — reports only whether a key is set (never the value).
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ hasKey: await hasTicketmasterApiKey() });
}

// POST /api/admin/ticketing-settings — save (or clear, with "") the Ticketmaster key.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const raw = body?.apiKey;
  if (raw !== undefined && typeof raw !== "string") {
    return NextResponse.json({ error: "apiKey must be a string." }, { status: 400 });
  }
  const key = (raw ?? "").trim();
  if (key.length > 0 && (key.length < 10 || !/^[A-Za-z0-9]+$/.test(key))) {
    return NextResponse.json({ error: "That doesn't look like a real Ticketmaster API key." }, { status: 400 });
  }
  await setTicketmasterApiKey(key);
  return NextResponse.json({ ok: true, hasKey: key.length > 0 });
}