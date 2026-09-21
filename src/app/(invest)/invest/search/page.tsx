import { Suspense } from "react";
import Link from "next/link";
import { COMPANY_CATALOG, TICKER_TYPE_LABEL } from "@/lib/invest/companies";
import { getQuote } from "@/lib/invest/market-data";
import { CompanyTile, NativeCard, PriceChange } from "@/components/invest-app/native";

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
    const unavailable = quote?.source === "unavailable";
    return (
      <Link
        href={`/invest/markets/${company.symbol}`}
        className="flex items-center gap-3 px-4 py-4 transition active:bg-white/[0.04]"
      >
        <CompanyTile symbol={company.mono} ticker={company.symbol} accent={company.accent} />
        <span className="min-w-0 flex-1 py-0.5">
          <span className="block text-[15px] leading-snug font-bold text-white">{company.name}</span>
          <span className="mt-1 block text-[12px] leading-snug text-zinc-500">
            {company.symbol} · {company.exchange}
            {company.type ? ` · ${TICKER_TYPE_LABEL[company.type]}` : ""}
          </span>
        </span>
        {unavailable ? (
          <span className="shrink-0 text-[12px] text-zinc-600">unavailable</span>
        ) : (
          <PriceChange price={quote?.price} changePct={quote?.changePct} change={quote?.change} />
        )}
      </Link>
    );
  };

  return (
    <div className="space-y-5">
      <form className="flex items-center gap-3 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-4 py-2 ring-1 ring-white/[0.08] focus-within:ring-sky-500/60">
        <svg className="h-5 w-5 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
        </svg>
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search ticker or company…"
          className="w-full bg-transparent py-3 text-[15px] font-semibold text-white outline-none placeholder:text-zinc-600"
          autoFocus
        />
      </form>

      <Suspense fallback={<p className="text-[13px] text-zinc-500">Loading…</p>}>
        {results.length === 0 ? (
          <NativeCard className="mt-7 px-5 py-10 text-center">
            <p className="text-[15px] font-bold text-white">No securities found</p>
            <p className="mt-1 text-[13px] text-zinc-500">Nothing matches “{q}”. Try a ticker or company name.</p>
          </NativeCard>
        ) : (
          <NativeCard className="divide-y divide-white/[0.06]">
            {results.map((c) => (
              <QuoteRow key={c.symbol} symbol={c.symbol} />
            ))}
          </NativeCard>
        )}
      </Suspense>
    </div>
  );
}