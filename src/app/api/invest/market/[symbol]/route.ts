import { NextResponse } from "next/server";
import { emptyHistory, getHistory, getQuote, unavailableQuote, type HistoryRange } from "@/lib/invest/market-data";
import { getCompany } from "@/lib/invest/companies";
import { safeWithDeadline } from "@/lib/safe-data";

export const dynamic = "force-dynamic";

const RANGES: HistoryRange[] = ["1D", "1W", "1M", "3M", "1Y", "5Y", "ALL"];

// The chart client falls back to its own "couldn't load" state if this never
// resolves, so keep the API response bounded too.
const API_BUDGET_MS = 3_000;

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const company = getCompany(symbol);
  if (!company) {
    return NextResponse.json({ error: "Unknown symbol" }, { status: 404 });
  }

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range") ?? "1D";
  const range = (RANGES as string[]).includes(rangeParam) ? (rangeParam as HistoryRange) : "1D";

  const [quote, history] = await safeWithDeadline(
    () => Promise.all([getQuote(company.symbol), getHistory(company.symbol, range)]),
    [unavailableQuote(company.symbol), emptyHistory(company.symbol, range)],
    API_BUDGET_MS,
  );

  return NextResponse.json({
    symbol: company.symbol,
    name: company.name,
    exchange: company.exchange,
    quote,
    history,
  });
}