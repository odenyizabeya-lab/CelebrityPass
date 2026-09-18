import { notFound } from "next/navigation";
import { getCompany } from "@/lib/invest/companies";
import { getHistory, getQuote } from "@/lib/invest/market-data";
import { TickerApp } from "@/components/invest-app/TickerApp";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return [];
}

export default async function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const company = getCompany(symbol);
  if (!company) notFound();

  const [quote, history1d] = await Promise.all([getQuote(company.symbol), getHistory(company.symbol, "1D")]);

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