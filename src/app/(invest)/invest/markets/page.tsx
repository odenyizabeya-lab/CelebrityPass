import { COMPANY_CATALOG } from "@/lib/invest/companies";
import { getQuote, unavailableQuote } from "@/lib/invest/market-data";
import { safeWithDeadline } from "@/lib/safe-data";
import Link from "next/link";
import { CompanyTile, Eye, NativeCard, SectionTitle } from "@/components/invest-app/native";

export const dynamic = "force-dynamic";

const PAGE_DATA_BUDGET_MS = 2_500;

export default async function MarketsPage() {
  const quotes = await safeWithDeadline(
    () => Promise.all(COMPANY_CATALOG.map((c) => getQuote(c.symbol))),
    COMPANY_CATALOG.map((c) => unavailableQuote(c.symbol)),
    PAGE_DATA_BUDGET_MS,
  );

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
        <NativeCard className="mt-3 divide-y divide-white/[0.06]">
          {COMPANY_CATALOG.map((company) => {
            const quote = quotes.find((q) => q.symbol === company.symbol) ?? unavailableQuote(company.symbol);
            const up = (quote?.change ?? 0) >= 0;
            const unavailable = quote?.source === "unavailable";
            return (
              <Link
                key={company.symbol}
                href={`/invest/markets/${company.symbol}`}
                className="flex items-center gap-3 px-4 py-4 transition active:bg-white/[0.04]"
              >
                <CompanyTile symbol={company.mono} accent={company.accent} />
                <span className="min-w-0 flex-1">
                  <span className="text-[15px] font-bold text-white">{company.name}</span>
                  <span className="mt-0.5 block truncate text-[12px] text-zinc-500">
                    {company.symbol} · {company.exchange} · {company.sectorTags[0]}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {unavailable ? (
                    <span className="text-[12px] text-zinc-600">unavailable</span>
                  ) : (
                    <>
                      <span className="block text-[16px] font-extrabold text-white">
                        ${quote?.price !== null && quote?.price !== undefined ? quote.price.toFixed(2) : "—"}
                      </span>
                      {quote?.changePct !== null && quote?.changePct !== undefined && (
                        <span className={`mt-0.5 block text-[13px] font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
                          {up ? "▲" : "▼"} {quote.changePct > 0 ? "+" : ""}
                          {quote.changePct.toFixed(2)}%
                        </span>
                      )}
                    </>
                  )}
                </span>
              </Link>
            );
          })}
        </NativeCard>
      </section>

      <p className="rounded-2xl bg-white/[0.02] px-4 py-3 text-center text-[11px] leading-relaxed text-zinc-600 ring-1 ring-white/[0.05]">
        Market prices shown are informational and are not an offer or solicitation to buy or sell any security.
      </p>
    </div>
  );
}