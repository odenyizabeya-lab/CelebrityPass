import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFanId } from "@/lib/auth";
import { getBrokerAccount, getPositions } from "@/lib/invest/brokerage";
import { getQuote } from "@/lib/invest/market-data";
import { COMPANY_CATALOG } from "@/lib/invest/companies";
import { safeAsync } from "@/lib/safe-data";

export const dynamic = "force-dynamic";

export default async function InvestHomePage() {
  const fanId = await getCurrentFanId();

  const [account, positions, featuredQuotes] = await Promise.all([
    fanId ? safeAsync(() => getBrokerAccount(fanId), null) : Promise.resolve(null),
    fanId ? safeAsync(() => getPositions(fanId), []) : Promise.resolve([]),
    Promise.all(COMPANY_CATALOG.slice(0, 4).map((c) => getQuote(c.symbol))),
  ]);

  let portfolioValue = 0;
  let accountPositions: { symbol: string; qty: number; value: number; isDemo: boolean }[] = [];
  if (positions && positions.length > 0) {
    accountPositions = await Promise.all(
      positions.map(async (p) => {
        const q = await getQuote(p.symbol);
        const qty = Number(p.quantityCents) / 1_000_000;
        const quotePrice = q.price ?? Number(p.avgCostCents) / 100;
        return {
          symbol: p.symbol,
          qty,
          value: qty * quotePrice,
          isDemo: p.isDemo,
        };
      }),
    );
    portfolioValue = accountPositions.reduce((s, p) => s + p.value, 0);
  }

  return (
    <div className="space-y-5">
      {/* Portfolio summary */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0b0f1a] to-[#0a0d13] p-5 ring-1 ring-white/[0.07]">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Total portfolio value</p>
        <p className="mt-1 text-3xl font-black tracking-tight text-white">
          ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="rounded-full bg-white/[0.05] px-3 py-1 font-semibold text-zinc-400 ring-1 ring-white/[0.07]">
            Available cash · {account ? `$${(account.buyingPowerCents / 100).toFixed(2)}` : "—"}
          </span>
          <span className={`rounded-full px-3 py-1 font-semibold ring-1 ${
            account?.status === "CONNECTED"
              ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
              : "bg-amber-500/10 text-amber-400 ring-amber-500/25"
          }`}>
            {account?.status === "CONNECTED" ? "Brokerage connected" : "Broker integration required"}
          </span>
        </div>
        {accountPositions.some((p) => p.isDemo) && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-widest text-amber-400 ring-1 ring-amber-500/20">
            DEMO / PAPER TRADING — holdings below are not real assets
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/invest/portfolio"
            className="rounded-full border border-white/15 px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-white/5"
          >
            Portfolio
          </Link>
          {!fanId ? (
            <Link
              href="/login?next=/invest"
              className="btn-grad rounded-full px-5 py-2.5 text-[13px] font-bold text-white"
            >
              Sign in
            </Link>
          ) : (
            <Link
              href="/invest/markets"
              className="btn-grad rounded-full px-5 py-2.5 text-[13px] font-bold text-white"
            >
              Explore markets
            </Link>
          )}
        </div>
      </div>

      {/* Featured markets */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold text-white">Featured markets</h2>
          <Link href="/invest/markets" className="text-[12px] font-bold text-sky-400">
            See all
          </Link>
        </div>
        <div className="mt-3 grid gap-2.5">
          {COMPANY_CATALOG.slice(0, 4).map((c, i) => {
            const q = featuredQuotes[i];
            const up = (q?.change ?? 0) >= 0;
            return (
              <Link
                key={c.symbol}
                href={`/invest/markets/${c.symbol}`}
                className="flex items-center gap-3 rounded-2xl bg-[#0a0d13] px-4 py-3 ring-1 ring-white/[0.07] transition hover:bg-white/[0.03]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[10px] font-black text-white" style={{ background: c.accent }}>
                  {c.symbol}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-white">{c.name}</span>
                  <span className="block text-[11px] text-zinc-500">{c.symbol} · {c.exchange}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[13px] font-extrabold text-white">
                    {q?.price !== null && q?.price !== undefined ? `$${q.price.toFixed(2)}` : "—"}
                  </span>
                  {q?.changePct !== null && q?.changePct !== undefined && (
                    <span className={`block text-[11px] font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
                      {up ? "▲" : "▼"} {q.changePct > 0 ? "+" : ""}{q.changePct.toFixed(2)}%
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <p className="rounded-lg bg-white/[0.02] px-3 py-2 text-center text-[11px] leading-relaxed text-zinc-600 ring-1 ring-white/[0.05]">
        The database of executed orders, holdings and transactions is separate from this profile. Nothing is shown as an
        investment unless an authorized brokerage execution exists.
      </p>
    </div>
  );
}