"use client";

import Link from "next/link";
import { COMPANY_CATALOG, TICKER_TYPE_LABEL, type Company } from "@/lib/invest/companies";
import { CompanyTile, NativeCard } from "./native";
import { useMarketQuotes, type MarketQuote } from "./market-store";

type InitialQuoteMap = Record<string, MarketQuote>;

/**
 * Live market list shared by Home ("Popular investments") and the Markets
 * screen. Both render the same rows and consume the same singleton store, so
 * the price for a symbol is identical everywhere and one poll covers the app.
 */
export function MarketList({
  initialQuotes = {},
  catalog = COMPANY_CATALOG,
  showMeta = false,
}: {
  initialQuotes?: InitialQuoteMap;
  catalog?: Company[];
  showMeta?: boolean;
}) {
  const { quotes } = useMarketQuotes(initialQuotes);

  return (
    <NativeCard className="divide-y divide-white/[0.06]">
      {catalog.map((company) => {
        const q = quotes[company.symbol];
        const unavailable = !q || q.source === "unavailable" || q.price === null || q.price === undefined;
        const up = (q?.change ?? 0) >= 0;
        return (
          <Link
            key={company.symbol}
            href={`/invest/markets/${company.symbol}`}
            className="flex items-center gap-3 px-4 py-4 transition active:bg-white/[0.04]"
          >
            <CompanyTile symbol={company.mono} ticker={company.symbol} accent={company.accent} />
            <span className="min-w-0 flex-1 py-0.5">
              <span className="block text-[15px] leading-snug font-bold text-white">{company.name}</span>
              <span className="mt-1 block text-[12px] leading-snug text-zinc-500">
                {company.symbol} · {company.exchange}
                {showMeta && company.type ? ` · ${TICKER_TYPE_LABEL[company.type]}` : ""}
                {showMeta && company.sectorTags[0] ? ` · ${company.sectorTags[0]}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-right">
              {unavailable ? (
                <span className="text-[12px] text-zinc-600">unavailable</span>
              ) : (
                <>
                  <span className="block text-[16px] font-extrabold text-white">
                    ${q.price!.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {q.changePct !== null && q.changePct !== undefined && (
                    <span className={`mt-0.5 block text-[13px] font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
                      {up ? "▲" : "▼"} {q.changePct > 0 ? "+" : ""}
                      {q.changePct.toFixed(2)}%
                    </span>
                  )}
                </>
              )}
            </span>
          </Link>
        );
      })}
    </NativeCard>
  );
}

export type { InitialQuoteMap };
