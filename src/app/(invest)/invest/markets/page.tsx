import { COMPANY_CATALOG } from "@/lib/invest/companies";
import { getQuotes, unavailableQuote } from "@/lib/invest/market-data";
import { safeWithDeadline } from "@/lib/safe-data";
import { Eye, SectionTitle } from "@/components/invest-app/native";
import { MarketList } from "@/components/invest-app/MarketList";

export const dynamic = "force-dynamic";

const PAGE_DATA_BUDGET_MS = 16_000;

export default async function MarketsPage() {
  // Batch fetch with per-symbol isolation: one failing/slow asset can never
  // blank the entire list.
  const quotes = await safeWithDeadline(
    () => getQuotes(COMPANY_CATALOG.map((c) => c.symbol)),
    COMPANY_CATALOG.map((c) => unavailableQuote(c.symbol)),
    PAGE_DATA_BUDGET_MS,
  );
  const initialQuotes = Object.fromEntries(quotes.map((q) => [q.symbol, q]));

  return (
    <div className="space-y-5 fade-up">
      <div>
        <Eye>Invest</Eye>
        <h1 className="mt-1 text-[26px] font-black tracking-tight text-white">Markets</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Eligible securities with live market data.</p>
      </div>

      <section>
        <div className="flex items-center justify-between px-1">
          <SectionTitle>All securities</SectionTitle>
          <span className="text-[12px] font-bold text-zinc-500">{COMPANY_CATALOG.length}</span>
        </div>
        <div className="mt-3">
          <MarketList initialQuotes={initialQuotes} showMeta />
        </div>
      </section>

      <p className="rounded-2xl bg-white/[0.02] px-4 py-3 text-center text-[11px] leading-relaxed text-zinc-600 ring-1 ring-white/[0.05]">
        Market prices shown are informational and are not an offer or solicitation to buy or sell any security.
      </p>
    </div>
  );
}