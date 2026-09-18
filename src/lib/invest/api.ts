import { NextResponse } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { getOrCreateInvestorAccount } from "./account";
import { InvestError } from "./orders";

/** Map an InvestError to an honest HTTP response (client can never fake success). */
export function investErrorResponse(err: unknown): NextResponse {
  if (err instanceof InvestError) {
    switch (err.code) {
      case "AMOUNT_INVALID":
        return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
      case "NOT_FOUND":
        return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
      case "INSUFFICIENT_FUNDS":
        return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
      case "KYC_REQUIRED":
      case "NOT_ELIGIBLE":
      case "NOT_OPEN":
      case "DISCLOSURES_REQUIRED":
        return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
      default:
        return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
  }
  console.error("[invest] unexpected error:", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** Resolve fan auth → investor account, or return an unauthorized response. */
export async function requireFanInvestor(fanId?: string | null) {
  const id = fanId ?? (await getCurrentFanId());
  if (!id) return { fanId: null as string | null, account: null as Awaited<ReturnType<typeof getOrCreateInvestorAccount>> | null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const account = await getOrCreateInvestorAccount(id);
  return { fanId: id, account, response: null as NextResponse | null };
}