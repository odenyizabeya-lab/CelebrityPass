import { COMPANY_CATALOG } from "@/lib/invest/companies";
import { getQuote } from "@/lib/invest/market-data";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const quotes = await Promise.all(COMPANY_CATALOG.map((c) => getQuote(c.symbol)));
  const rows = COMPANY_CATALOG.map((c, i) => ({ company: c, quote: quotes[i] }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-white">Markets</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Eligible securities available to explore.</p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-[#0a0d13] ring-1 ring-white/[0.07]">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <span>Company</span>
          <span />
          <span className="text-right">Price / Chg</span>
        </div>
        {rows.map(({ company, quote }) => {
          const up = (quote?.change ?? 0) >= 0;
          const unavailable = quote?.source === "unavailable";
          return (
            <Link
              key={company.symbol}
              href={`/invest/markets/${company.symbol}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-white/[0.05] px-4 py-3.5 transition hover:bg-white/[0.03]"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[10px] font-black text-white"
                style={{ background: company.accent }}
              >
                {company.symbol}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-bold text-white">{company.name}</span>
                <span className="block text-[11px] font-medium text-zinc-500">
                  {company.symbol} · {company.exchange}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-zinc-600">{company.sectorTags[0]}</span>
              </span>
              <span className="text-right">
                {unavailable ? (
                  <span className="text-[11px] text-zinc-600">unavailable</span>
                ) : (
                  <>
                    <span className="block text-[14px] font-extrabold text-white">
                      ${quote?.price !== null && quote?.price !== undefined ? quote.price.toFixed(2) : "—"}
                    </span>
                    {quote?.changePct !== null && quote?.changePct !== undefined && (
                      <span className={`block text-[12px] font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
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
      </div>

      <p className="rounded-lg bg-white/[0.02] px-3 py-2 text-center text-[11px] text-zinc-600 ring-1 ring-white/[0.05]">
        Market prices shown are informational and are not an offer or solicitation to buy or sell any security.
      </p>
    </div>
  );
}