import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { loadOnboardingCelebrities } from "@/lib/onboarding-celebrities";
import { safeWithDeadline } from "@/lib/safe-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Shared with the onboarding page so the list can never drift between the
  // two, and so the page can render the list server-side without a client fetch.
  // The pooled Postgres connection is refused or dropped intermittently. That
  // leaves the promise pending rather than rejecting, so a try/catch alone is
  // not enough: without a deadline this request hangs until the client gives up
  // and the picker shows a misleading "took too long" message. Answer with a
  // real, retryable status instead.
  const celebrities = await safeWithDeadline(() => loadOnboardingCelebrities(fanId), null, 6000);
  if (celebrities === null) {
    return NextResponse.json({ error: "Could not load celebrities" }, { status: 503 });
  }
  return NextResponse.json({ celebrities });
}

export async function POST(request: Request) {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const bodyIds: unknown = Array.isArray(body?.celebrityIds) ? body.celebrityIds : [];
  const ids: string[] = [...new Set((bodyIds as unknown[]).map((x) => String(x)).filter((id) => id.length > 0))];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Choose at least one celebrity" }, { status: 400 });
  }
  if (ids.length > 30) {
    return NextResponse.json({ error: "Choose at most 30 celebrities" }, { status: 400 });
  }

  // Same reasoning as GET: a dropped or refused pooled connection must not turn
  // into a hung request, and the client's save timeout then shows a misleading
  // "took too long" message. `safeWithDeadline` distinguishes the three cases:
  // null = timed out or threw (503), "unavailable" = bad ids (400), ok = saved.
  const outcome = await safeWithDeadline(
    async () => {
      const found = await prisma.celebrity.findMany({
        where: { id: { in: ids }, isActive: true, fansCardEnabled: true },
        select: { id: true },
      });
      if (found.length !== ids.length) return "unavailable" as const;
      await prisma.$transaction([
        prisma.fanCelebritySelection.deleteMany({ where: { fanId } }),
        prisma.fanCelebritySelection.createMany({
          data: ids.map((celebrityId) => ({ fanId, celebrityId })),
        }),
      ]);
      return "saved" as const;
    },
    null,
    8000,
  );

  if (outcome === null) {
    return NextResponse.json({ error: "Could not save your choices" }, { status: 503 });
  }
  if (outcome === "unavailable") {
    return NextResponse.json({ error: "One or more celebrities are unavailable" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, count: ids.length });
}