import { NextResponse } from "next/server";
import { emptyHistory, getHistory, getQuote, unavailableQuote, type HistoryRange } from "@/lib/invest/market-data";
import { getCompany } from "@/lib/invest/companies";
import { safeWithDeadline } from "@/lib/safe-data";

export const dynamic = "force-dynamic";

const RANGES: HistoryRange[] = ["1D", "1W", "1M", "3M", "1Y", "5Y", "ALL"];

// Quote and history have separate budgets and never share a deadline: a slow
// provider for one must not blank the other. The chart client has its own
// fallback + auto-retry, so history gets a longer leash than the quote.
const QUOTE_BUDGET_MS = 6_000;
const HISTORY_BUDGET_MS = 11_000;

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const company = getCompany(symbol);
  if (!company) {
    return NextResponse.json({ error: "Unknown symbol" }, { status: 404 });
  }

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range") ?? "1D";
  const range = (RANGES as string[]).includes(rangeParam) ? (rangeParam as HistoryRange) : "1D";

  const [quote, history] = await Promise.all([
    safeWithDeadline(() => getQuote(company.symbol), unavailableQuote(company.symbol), QUOTE_BUDGET_MS),
    safeWithDeadline(() => getHistory(company.symbol, range), emptyHistory(company.symbol, range), HISTORY_BUDGET_MS),
  ]);

  return NextResponse.json({
    symbol: company.symbol,
    name: company.name,
    exchange: company.exchange,
    quote,
    history,
  });
}