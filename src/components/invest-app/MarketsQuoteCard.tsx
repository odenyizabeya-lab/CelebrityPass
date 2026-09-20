import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";
import { getCompany } from "@/lib/invest/companies";
import { getQuote } from "@/lib/invest/market-data";

/**
 * Compact "latest quote" card linking into the public markets app. Rendered on
 * business/political profile pages INSTEAD of any celebrity offering/fundraise
 * widget — this person does not sell securities here.
 */
export async function MarketsQuoteCard({ symbol, label }: { symbol: string; label?: string }) {
  const company = getCompany(symbol);
  if (!company) return null;
  const quote = await getQuote(company.symbol);
  const unavailable = quote.source === "unavailable";
  const up = (quote?.change ?? 0) >= 0;

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
        {label ?? "Markets · real-time quotes"}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[10px] font-black text-white"
            style={{ background: company.accent }}
          >
            {company.symbol}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5">
              <span className="truncate text-sm font-bold text-white">{company.name}</span>
              <VerifiedBadge className="h-4 w-4 shrink-0" />
            </p>
            <p className="text-[11px] font-medium text-zinc-500">
              {company.symbol} · {company.exchange}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {unavailable ? (
            <p className="text-[11px] font-semibold text-zinc-600">unavailable</p>
          ) : (
            <>
              <p className="text-base font-extrabold text-white">
                ${quote?.price !== null && quote?.price !== undefined ? quote.price.toFixed(2) : "—"}
              </p>
              {quote?.changePct !== null && quote?.changePct !== undefined && (
                <p className={`text-[11px] font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
                  {up ? "▲" : "▼"} {quote.changePct > 0 ? "+" : ""}
                  {quote.changePct.toFixed(2)}%
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <Link
        href={`/invest/markets/${company.symbol}`}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/[0.08] px-5 py-2.5 text-sm font-bold text-amber-300 transition hover:bg-amber-400/20"
      >
        View {company.name} on the markets app
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M13 5l7 7-7 7-1.4-1.4L16.2 13H4v-2h12.2l-4.6-4.6z" />
        </svg>
      </Link>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        Market prices are informational and are not an offer or solicitation. Investing in publicly traded companies
        carries risk and is available only through an authorized brokerage.
      </p>
    </div>
  );
}