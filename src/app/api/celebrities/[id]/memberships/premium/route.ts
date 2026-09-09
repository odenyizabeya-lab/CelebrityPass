// POST /api/celebrities/[id]/memberships/premium — apply the shared premium
// "Experience" ladder ($2,500 – $15,000,000) to one celebrity. Idempotent.
// Reuses the exact same template used at deploy time so every community keeps
// the identical ceiling and tier naming.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/auth";
import { upsertPremiumLevels } from "../../../../../../../prisma/premium-levels.mjs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Ctx) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const celebrity = await prisma.celebrity.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true },
  });
  if (!celebrity) return NextResponse.json({ error: "Celebrity not found" }, { status: 404 });

  const result = await upsertPremiumLevels(prisma, celebrity);
  return NextResponse.json({ result });
}