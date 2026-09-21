import { NextResponse } from "next/server";
import { getLiveTick, unavailableQuote } from "@/lib/invest/market-data";
import { getCompany } from "@/lib/invest/companies";
import { safeWithDeadline } from "@/lib/safe-data";

export const dynamic = "force-dynamic";

// Bounded so the client's poll never hangs the page — but generous enough for
// slow/cold upstreams (Yahoo's retry can take ~18s worst-case before a valid
// quote is produced; that must not masquerade as "unavailable").
const LIVE_BUDGET_MS = 24_000;

// Never cache anywhere: this is the real-time feed on the detail page.
const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const company = getCompany(symbol);
  if (!company) {
    return NextResponse.json({ error: "Unknown symbol" }, { status: 404 });
  }

  const quote = await safeWithDeadline(
    () => getLiveTick(company.symbol),
    unavailableQuote(company.symbol),
    LIVE_BUDGET_MS,
  );

  return NextResponse.json(
    {
      symbol: company.symbol,
      name: company.name,
      quote,
    },
    { headers: NO_STORE },
  );
}