import { notFound } from "next/navigation";
import { getCompany } from "@/lib/invest/companies";
import { emptyHistory, getHistory, getQuote, unavailableQuote } from "@/lib/invest/market-data";
import { safeWithDeadline } from "@/lib/safe-data";
import { TickerApp } from "@/components/invest-app/TickerApp";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return [];
}

// Total budget for the initial server-rendered quote+chart. If the market-data
// upstream is slow or rate-limited, the page still paints within this window
// and the client chart shows its own loading/fallback state.
const PAGE_DATA_BUDGET_MS = 2_500;

export default async function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const company = getCompany(symbol);
  if (!company) notFound();

  const [quote, history1d] = await safeWithDeadline(
    async () => Promise.all([getQuote(company.symbol), getHistory(company.symbol, "1D")]),
    [unavailableQuote(company.symbol), emptyHistory(company.symbol, "1D")],
    PAGE_DATA_BUDGET_MS,
  );

  return (
    <TickerApp
      symbol={company.symbol}
      name={company.name}
      exchange={company.exchange}
      sectorTags={company.sectorTags}
      description={company.description}
      profileUrl={company.profileUrl}
      accent={company.accent}
      initialQuote={quote}
      initialHistory={history1d}
      minAmountUsd={process.env.INVEST_MIN_AMOUNT_USD ? Number(process.env.INVEST_MIN_AMOUNT_USD) : 100}
    />
  );
}