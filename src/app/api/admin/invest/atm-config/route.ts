import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { getAtmInstructions, setAtmInstructions, ATM_INSTRUCTIONS_SETTING } from "@/lib/invest/atm";
import { auditLog } from "@/lib/invest/audit";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_LEN = 6_000;

// GET /api/admin/invest/atm-config — the admin-managed ATM deposit instructions.
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const instructions = await getAtmInstructions();
  const isDefault = !(
    await prisma.appSetting.findUnique({ where: { key: ATM_INSTRUCTIONS_SETTING } })
  )?.value;
  return NextResponse.json({ instructions, isDefault });
}

// POST /api/admin/invest/atm-config — save the ATM deposit instructions shown
// to investors in the ATM Deposit flow (never monetary values, text only).
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const value = String(body?.instructions ?? "").trim();
  if (value.length > MAX_LEN) {
    return NextResponse.json({ error: `Instructions must be under ${MAX_LEN} characters.` }, { status: 400 });
  }
  await setAtmInstructions(value);
  await auditLog({
    actorType: "admin",
    actorId: undefined,
    action: "ATM_INSTRUCTIONS_UPDATED",
    entityType: "AppSetting",
    entityId: ATM_INSTRUCTIONS_SETTING,
    details: { length: value.length },
  }).catch(() => {});
  return NextResponse.json({ ok: true, instructions: value || (await getAtmInstructions()) });
}