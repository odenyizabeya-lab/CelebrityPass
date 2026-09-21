import { NextResponse } from "next/server";
import { getQuotes, unavailableQuote } from "@/lib/invest/market-data";
import { COMPANY_CATALOG } from "@/lib/invest/companies";
import { safeWithDeadline } from "@/lib/safe-data";

export const dynamic = "force-dynamic";

// Bounded so the client poll never hangs. Per-symbol failures are isolated
// inside getQuotes, so one slow 429'd asset can never blank the whole list.
const LIST_BUDGET_MS = 30_000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("symbols");
  const symbols = query
    ? query
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    : COMPANY_CATALOG.map((c) => c.symbol);

  const quotes = await safeWithDeadline(
    () => getQuotes(symbols),
    symbols.map((s) => unavailableQuote(s)),
    LIST_BUDGET_MS,
  );

  return NextResponse.json({
    symbols,
    quotes,
    fetchedAt: new Date().toISOString(),
  });
}