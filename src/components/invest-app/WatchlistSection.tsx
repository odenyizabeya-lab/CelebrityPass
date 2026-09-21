"use client";

import Link from "next/link";
import type { Company } from "@/lib/invest/companies";
import { useWatchlist, WatchStar } from "./Watchlist";
import { NativeCard, CompanyTile } from "./native";
import { useMarketQuotes } from "./market-store";

export function WatchlistSection({
  catalog,
  placeholderSymbols = ["TSLA", "AAPL", "MSFT", "NVDA"],
}: {
  catalog: Company[];
  placeholderSymbols?: string[];
}) {
  const { symbols, toggle } = useWatchlist();
  const shown = symbols.length > 0 ? symbols : placeholderSymbols;
  // Shared live feed — same poller/data as Home and Markets, so the watchlist
  // price can never disagree with the price shown on the market list.
  const { quotes } = useMarketQuotes();

  return (
    <NativeCard className="mt-3 divide-y divide-white/[0.06]">
      {shown.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[15px] font-bold text-white">Your watchlist is empty</p>
          <p className="mt-1 text-[13px] text-zinc-500">
            Tap the star on any market or stock page to follow it here.
          </p>
          <Link href="/invest/markets" className="mt-3 inline-block text-[13px] font-bold text-sky-400">
            Browse markets ›
          </Link>
        </div>
      ) : (
        shown.map((sym) => {
          const company = catalog.find((c) => c.symbol === sym);
          const q = quotes[sym];
          const hasPrice = q && q.source !== "unavailable" && q.price !== null && q.price !== undefined;
          const up = (q?.change ?? 0) >= 0;
          return (
            <Link
              key={sym}
              href={`/invest/markets/${sym}`}
              className="flex items-center gap-3 px-4 py-4 transition active:bg-white/[0.04]"
            >
              <CompanyTile symbol={company?.mono ?? sym} ticker={sym} accent={company?.accent ?? "#334155"} />
              <span className="min-w-0 flex-1 py-0.5">
                <span className="block text-[15px] leading-snug font-bold text-white">{company?.name ?? sym}</span>
                <span className="mt-1 block text-[12px] leading-snug text-zinc-500">{sym} · {company?.exchange ?? "—"}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[15px] font-extrabold text-white">
                  {hasPrice ? `$${q.price!.toFixed(2)}` : "—"}
                </span>
                {hasPrice && q.changePct !== null && q.changePct !== undefined && (
                  <span className={`block text-[12px] font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
                    {up ? "▲" : "▼"} {q.changePct > 0 ? "+" : ""}{q.changePct.toFixed(2)}%
                  </span>
                )}
              </span>
              <button
                type="button"
                aria-label={symbols.includes(sym) ? `Remove ${sym} from watchlist` : `Add ${sym} to watchlist`}
                onClick={(e) => {
                  e.preventDefault();
                  toggle(sym);
                }}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.07] active:scale-90"
              >
                <WatchStar symbol={sym} on={symbols.includes(sym)} />
              </button>
            </Link>
          );
        })
      )}
    </NativeCard>
  );
}