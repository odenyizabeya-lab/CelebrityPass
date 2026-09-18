import { Suspense } from "react";
import Link from "next/link";
import { COMPANY_CATALOG } from "@/lib/invest/companies";
import { getQuote } from "@/lib/invest/market-data";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const { q } = (await searchParams) ?? {};
  const query = (q ?? "").trim().toUpperCase();
  const results = query
    ? COMPANY_CATALOG.filter((c) => c.symbol.includes(query) || c.name.toUpperCase().includes(query))
    : COMPANY_CATALOG;

  const QuoteRow = async ({ symbol }: { symbol: string }) => {
    const quote = await getQuote(symbol);
    const company = COMPANY_CATALOG.find((c) => c.symbol === symbol)!;
    const up = (quote?.change ?? 0) >= 0;
    return (
      <Link
        href={`/invest/markets/${company.symbol}`}
        className="flex items-center gap-3 rounded-2xl bg-[#0a0d13] px-4 py-3.5 ring-1 ring-white/[0.07] transition hover:bg-white/[0.03]"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[10px] font-black text-white" style={{ background: company.accent }}>
          {company.symbol}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-white">{company.name}</span>
          <span className="block text-[11px] text-zinc-500">{company.symbol} · {company.exchange}</span>
        </span>
        <span className="text-right">
          <span className="block text-[13px] font-extrabold text-white">
            {quote?.price !== null && quote?.price !== undefined ? `$${quote.price.toFixed(2)}` : "—"}
          </span>
          {quote?.changePct !== null && quote?.changePct !== undefined && (
            <span className={`block text-[11px] font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
              {up ? "▲" : "▼"} {quote.changePct > 0 ? "+" : ""}{quote.changePct.toFixed(2)}%
            </span>
          )}
        </span>
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <form className="flex items-center gap-2 rounded-2xl bg-[#0a0d13] px-3.5 py-2.5 ring-1 ring-white/[0.08]">
        <svg className="h-5 w-5 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
        </svg>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search ticker or company…"
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
          autoFocus
        />
      </form>

      <Suspense fallback={<p className="text-[13px] text-zinc-500">Loading…</p>}>
        <div className="space-y-2.5">
          {results.map((c) => (
            <QuoteRow key={c.symbol} symbol={c.symbol} />
          ))}
          {results.length === 0 && (
            <div className="rounded-2xl bg-[#0a0d13] px-4 py-8 text-center text-[13px] text-zinc-500 ring-1 ring-white/[0.07]">
              No securities found for “{q}”.
            </div>
          )}
        </div>
      </Suspense>
    </div>
  );
}