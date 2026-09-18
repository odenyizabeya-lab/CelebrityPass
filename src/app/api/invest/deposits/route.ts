import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentFanId } from "@/lib/auth";
import { createDepositIntent } from "@/lib/invest/deposits";
import { investErrorResponse } from "@/lib/invest/api";

export const dynamic = "force-dynamic";

// POST /api/invest/deposits
//   demo mode — credits the simulated cash wallet (idempotent per clientRef).
//   live mode  — creates a PENDING ledger transaction + returns the hosted
//                Flutterwave checkout link; the webhook settles the deposit.
//   Demo notifications/types differ from live; everything returns a txnRef just
//   the same so the UI can show a confirmation reference either way.
export async function POST(request: NextRequest) {
  const fanId = await getCurrentFanId();
  if (!fanId) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const raw = String(body?.amount ?? "").trim();
  const amount = /^\d+(\.\d{1,2})?$/.test(raw) ? new Prisma.Decimal(raw) : null;
  if (!amount) return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });

  const clientRef = String(body?.clientRef ?? "default").trim().slice(0, 60) || "default";

  try {
    const intent = await createDepositIntent({
      fanId,
      amount,
      clientRef,
      ipAddress: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({
      ok: true,
      mode: intent.mode,
      txnRef: intent.txnRef,
      status: intent.mode === "demo" ? "SUCCESSFUL" : "PENDING",
      link: intent.link,
    });
  } catch (err) {
    return investErrorResponse(err);
  }
}