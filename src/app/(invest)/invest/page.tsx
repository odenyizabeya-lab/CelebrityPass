import Link from "next/link";
import { getCurrentFanId } from "@/lib/auth";
import { getPositions, getTransactions, quantityToNumber, syncBrokerAccount } from "@/lib/invest/brokerage";
import { getQuote } from "@/lib/invest/market-data";
import { getOrCreateInvestorAccount } from "@/lib/invest/account";
import { investorBalances } from "@/lib/invest/ledger";
import { COMPANY_CATALOG } from "@/lib/invest/companies";
import { safeAsync, safeWithDeadline } from "@/lib/safe-data";
import { CompanyTile, Eye, NativeCard, SectionTitle, PrimaryAction, SecondaryAction, Metric } from "@/components/invest-app/native";
import { WatchlistSection } from "@/components/invest-app/WatchlistSection";

export const dynamic = "force-dynamic";

const PAGE_DATA_BUDGET_MS = 2_500;

const fmt2 = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function InvestHomePage() {
  const fanId = await getCurrentFanId();

  const [account, positions, balances, featuredQuotes, recentTx] = await safeWithDeadline(
    async () =>
      Promise.all([
        fanId ? safeAsync(() => syncBrokerAccount(fanId), null) : Promise.resolve(null),
        fanId ? safeAsync(() => getPositions(fanId), []) : Promise.resolve([]),
        fanId
          ? safeAsync(async () => {
              const inv = await getOrCreateInvestorAccount(fanId);
              return investorBalances(inv.id);
            }, null)
          : Promise.resolve(null),
        Promise.all(COMPANY_CATALOG.slice(0, 4).map((c) => getQuote(c.symbol))),
        fanId ? safeAsync(() => getTransactions(fanId, 5), []) : Promise.resolve([]),
      ]),
    [null as never, [] as never[], null, COMPANY_CATALOG.slice(0, 4).map(() => null as never), [] as never[]],
    PAGE_DATA_BUDGET_MS,
  );

  let portfolioValue = 0;
  let todayChange = 0;
  let accountPositions: { symbol: string; qty: number; value: number; change: number; isDemo: boolean }[] = [];
  if (positions && positions.length > 0) {
    accountPositions = await Promise.all(
      positions.map(async (p) => {
        const q = await getQuote(p.symbol);
        const qty = quantityToNumber(p.quantityCents);
        const quotePrice = q.price ?? Number(p.avgCostCents) / 100;
        const change = q.change ?? 0;
        return {
          symbol: p.symbol,
          qty,
          value: qty * quotePrice,
          change: qty * change,
          isDemo: p.isDemo,
        };
      }),
    );
    portfolioValue = accountPositions.reduce((s, p) => s + p.value, 0);
    todayChange = accountPositions.reduce((s, p) => s + (p.change ?? 0), 0);
  }
  const cash = balances ? Number(balances.cash) : 0;
  const changeUp = todayChange >= 0;

  return (
    <div className="space-y-6">
      {/* ==== Dashboard hero ==== */}
      <section className="fade-up">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
          {fanId ? "Investment" : "Explore investing"}
        </p>
        <h1 className="mt-1 text-[26px] font-black tracking-tight text-white">
          {fanId ? "Your portfolio" : "Invest in public companies"}
        </h1>

        <NativeCard className="relative mt-4 overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-purple-600/20 blur-[70px]" />
          <Eye>Portfolio value</Eye>
          <p className="mt-1 text-[42px] font-black leading-none tracking-tight text-white">
            ${fmt2(portfolioValue)}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-5 border-t border-white/[0.07] pt-4">
            <Metric
              label="Available cash"
              value={`$${fmt2(cash)}`}
              valueClass="text-[22px] text-white"
            />
            <Metric
              label="Today's change"
              value={`${changeUp ? "+" : "−"}$${fmt2(Math.abs(todayChange))}`}
              valueClass={`text-[22px] ${changeUp ? "text-emerald-400" : "text-rose-400"}`}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
            <span
              className={`rounded-full px-3 py-1 font-bold ring-1 ${
                account?.status === "CONNECTED"
                  ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 ring-amber-500/25"
              }`}
            >
              {account?.status === "CONNECTED" ? "Brokerage connected" : "Broker integration required"}
            </span>
            {accountPositions.some((p) => p.isDemo) && (
              <span className="rounded-full bg-amber-500/10 px-3 py-1 font-bold text-amber-400 ring-1 ring-amber-500/25">
                Demo / paper trading
              </span>
            )}
          </div>
        </NativeCard>

        {/* Quick actions */}
        <div className="mt-4 grid gap-2.5">
          <div className="grid grid-cols-3 gap-2.5">
            <PrimaryAction href={fanId ? "/invest/deposit" : "/login?next=/invest/deposit"} className="rounded-2xl py-3.5 text-[14px]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
              Deposit
            </PrimaryAction>
            <SecondaryAction href="/invest/markets" className="rounded-2xl py-3.5 text-[14px]">
              <span className="text-sky-400">▲</span> Invest
            </SecondaryAction>
            <SecondaryAction href={fanId ? "/invest/portfolio" : "/login?next=/invest/portfolio"} className="rounded-2xl py-3.5 text-[14px]">
              Portfolio
            </SecondaryAction>
          </div>
          {!fanId && (
            <SecondaryAction href="/login?next=/invest">
              Sign in to see balances, trades and holdings
            </SecondaryAction>
          )}
        </div>
      </section>

      {/* ==== Popular investments ==== */}
      <section className="fade-up">
        <div className="flex items-center justify-between">
          <SectionTitle>Popular investments</SectionTitle>
          <Link href="/invest/markets" className="text-[13px] font-bold text-sky-400">
            See all
          </Link>
        </div>
        <NativeCard className="mt-3 divide-y divide-white/[0.06]">
          {COMPANY_CATALOG.slice(0, 4).map((c, i) => {
            const q = featuredQuotes[i];
            const up = (q?.change ?? 0) >= 0;
            const unavailable = q?.source === "unavailable";
            return (
              <Link
                key={c.symbol}
                href={`/invest/markets/${c.symbol}`}
                className="flex items-center gap-3 px-4 py-4 transition active:bg-white/[0.04]"
              >
                <CompanyTile symbol={c.mono} accent={c.accent} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-bold text-white">{c.name}</span>
                  </span>
                  <span className="block text-[12px] text-zinc-500">{c.symbol} · {c.exchange}</span>
                </span>
                <span className="shrink-0 text-right">
                  {unavailable ? (
                    <span className="text-[12px] text-zinc-600">unavailable</span>
                  ) : (
                    <>
                      <span className="block text-[15px] font-extrabold text-white">
                        {q?.price !== null && q?.price !== undefined ? `$${q.price.toFixed(2)}` : "—"}
                      </span>
                      {q?.changePct !== null && q?.changePct !== undefined && (
                        <span className={`block text-[12px] font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
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
      </section>

      {/* ==== Watchlist (device-local, native star) ==== */}
      <section className="fade-up">
        <div className="flex items-center justify-between">
          <SectionTitle>Watchlist</SectionTitle>
          <Link href="/invest/markets" className="text-[13px] font-bold text-sky-400">
            Edit
          </Link>
        </div>
        <WatchlistSection catalog={COMPANY_CATALOG.slice(0, 4)} />
      </section>

      {/* ==== Recent activity ==== */}
      <section className="fade-up">
        <div className="flex items-center justify-between">
          <SectionTitle>Recent activity</SectionTitle>
          {fanId && (
            <Link href="/invest/portfolio" className="text-[13px] font-bold text-sky-400">
              View all
            </Link>
          )}
        </div>
        <NativeCard className="mt-3 divide-y divide-white/[0.06]">
          {!fanId ? (
            <div className="px-5 py-8 text-center">
              <p className="text-[15px] font-bold text-white">No activity yet</p>
              <p className="mt-1 text-[13px] text-zinc-500">
                Your trades and deposits will appear here.
              </p>
            </div>
          ) : recentTx.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-[15px] font-bold text-white">No activity yet</p>
              <p className="mt-1 text-[13px] text-zinc-500">
                Deposits and completed brokerage executions show up here.
              </p>
            </div>
          ) : (
            recentTx.map((t) => {
              const amt = Number(t.amountCents) / 100;
              const deposit = t.kind === "DEPOSIT";
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[14px] font-black ${
                      deposit ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"
                    }`}
                  >
                    {deposit ? "↓" : "↗"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-white">{t.kind.replace(/_/g, " ")}</p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {t.ref} · {new Date(t.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[14px] font-extrabold ${deposit ? "text-emerald-400" : "text-white"}`}>
                    ${amt.toFixed(2)}
                  </span>
                </div>
              );
            })
          )}
        </NativeCard>
      </section>

      {/* ==== Markets strip ==== */}
      <section className="fade-up">
        <div className="flex items-center justify-between">
          <SectionTitle>Markets</SectionTitle>
          <Link href="/invest/news" className="text-[13px] font-bold text-sky-400">
            News
          </Link>
        </div>
        <NativeCard className="mt-3 p-4">
          <Link href="/invest/markets" className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10m5 10V4m5 16v-8m5 8V7" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-white">Browse all markets</span>
              <span className="block text-[12px] text-zinc-500">Live quotes for every eligible security</span>
            </span>
            <span className="shrink-0 text-[13px] font-bold text-sky-400">Open ›</span>
          </Link>
        </NativeCard>
      </section>

      <p className="rounded-2xl bg-white/[0.02] px-4 py-3 text-center text-[11px] leading-relaxed text-zinc-600 ring-1 ring-white/[0.05]">
        The database of executed orders, holdings and transactions is separate from this profile. Nothing is shown as an
        investment unless an authorized brokerage execution exists.
      </p>
    </div>
  );
}