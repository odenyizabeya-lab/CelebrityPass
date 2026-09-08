import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { getEligibleContent } from "@/lib/social/service";

export const dynamic = "force-dynamic";

// GET /api/social/admin/content?scope=all|eligible — lists for the composer + eligibility manager.
export async function GET(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "eligible" ? "eligible" : "all";
  const content = await getEligibleContent(scope);
  return NextResponse.json(content);
}

// POST /api/social/admin/content/toggle
//   body: { entity: "celebrity"|"membership"|"event"|"article", id, enabled }
// Flips the automatic-posting eligibility flag on a content entity.
export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Sub-route detection: /api/social/admin/content/toggle
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/toggle")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const entity = String(body?.entity ?? "");
  const id = String(body?.id ?? "");
  const enabled = Boolean(body?.enabled);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const toggles = {
    celebrity: () => prisma.celebrity.update({ where: { id }, data: { socialAutoPost: enabled } }),
    membership: () => prisma.membershipLevel.update({ where: { id }, data: { socialAutoPost: enabled } }),
    event: () => prisma.celebrityEvent.update({ where: { id }, data: { socialAutoPost: enabled } }),
    article: () => prisma.socialArticle.update({ where: { id }, data: { autoPostEnabled: enabled } }),
  } as const;

  const fn = toggles[entity as keyof typeof toggles];
  if (!fn) return NextResponse.json({ error: "Unknown entity type" }, { status: 400 });

  try {
    await fn();
  } catch {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE variant to keep the client simple when using method disambiguation.
export async function DELETE() {
  return NextResponse.json({ error: "Method not allowed; use POST to /toggle" }, { status: 405 });
}