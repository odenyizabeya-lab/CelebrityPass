// GET /api/admin/ai/reply — global + per-celebrity auto-reply toggle state.
// POST /api/admin/ai/reply — flip the global switch or a celebrity's switch.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isGlobalAutoReplyEnabled,
  setGlobalAutoReplyEnabled,
  setCelebrityAutoReplyEnabled,
} from "@/lib/chat/autoReplySettings";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [globalEnabled, celebrities] = await Promise.all([
    isGlobalAutoReplyEnabled(),
    prisma.celebrity.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true, chatAutoReplyEnabled: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    globalEnabled,
    celebrities: celebrities.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      enabled: c.chatAutoReplyEnabled !== false,
    })),
  });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (typeof body.globalEnabled === "boolean") {
    await setGlobalAutoReplyEnabled(body.globalEnabled);
  } else if (
    typeof body.celebrityId === "string" &&
    typeof body.enabled === "boolean"
  ) {
    await setCelebrityAutoReplyEnabled(body.celebrityId, body.enabled);
  } else {
    return NextResponse.json({ error: "globalEnabled or celebrityId+enabled required" }, { status: 400 });
  }

  const globalEnabled = await isGlobalAutoReplyEnabled();
  return NextResponse.json({ ok: true, globalEnabled });
}