"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { COMPANY_CATALOG } from "@/lib/invest/companies";
import { CompanyTile, Eye, NativeCard, SectionTitle, PrimaryAction, SecondaryAction, Metric } from "@/components/invest-app/native";
import { WatchlistSection } from "@/components/invest-app/WatchlistSection";

/**
 * The invest app "Home" embedded directly on the (public, cached) celebrity
 * profile — Fetched in the browser so the personalized portfolio/deposits are
 * per-visitor and never leak into the ISR cache. Every piece (markup, cards,
 * quick actions, watchlist) is the exact invest-home componentry fed through
 * the public client APIs — no server secrets, no duplicate payment logic.
 */
type Quote = { price: number | null; changePct: number | null; change: number | null; source: string };
type LedgerTx = { txnRef: string; kind: string; direction: string; amount: string; currency: string; createdAt: string };

type HomeData = {
  signedIn: boolean;
  portfolioValue: number;
  cash: number;
  todayChange: number;
  changeUp: boolean;
  hasDemo: boolean;
  positionCount: number;
  brokerStatus: string | null;
  transactions: LedgerTx[];
};

const fmt2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2.5">
        <div className="h-3 w-24 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="h-7 w-44 animate-pulse rounded-xl bg-white/[0.06]" />
        <div className="mt-3 h-44 animate-pulse rounded-3xl bg-white/[0.05] ring-1 ring-white/[0.06]" />
        <div className="grid grid-cols-3 gap-2.5">
          <div className="h-12 animate-pulse rounded-2xl bg-white/[0.05]" />
          <div className="h-12 animate-pulse rounded-2xl bg-white/[0.05]" />
          <div className="h-12 animate-pulse rounded-2xl bg-white/[0.05]" />
        </div>
        <div className="h-48 animate-pulse rounded-3xl bg-white/[0.05] ring-1 ring-white/[0.06]" />
      </div>
    </div>
  );
}

export default function InvestHomeEmbed() {
  const [data, setData] = useState<HomeData | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      let signedIn = false;
      let portfolioValue = 0;
      let cash = 0;
      let todayChange = 0;
      let changeUp = true;
      let hasDemo = false;
      let positionCount = 0;
      let brokerStatus: string | null = null;
      let transactions: LedgerTx[] = [];

      try {
        const acc = await fetch("/api/invest/account", { cache: "no-store", credentials: "include" });
        signedIn = acc.status === 200;
        if (signedIn) {
          const body = await acc.json().catch(() => null);
          if (body) {
            cash = Number(body.balances?.cash ?? 0);
            brokerStatus = typeof body.brokerStatus === "string" ? body.brokerStatus : null;
            const p = body.portfolio ?? {};
            portfolioValue = Number(p.value ?? 0);
            todayChange = Number(p.change ?? 0);
            changeUp = portfolioValue === 0 ? true : Boolean(p.changeUp ?? todayChange >= 0);
            hasDemo = Boolean(p.hasDemo);
            positionCount = Number(p.positionCount ?? 0);
          }
          const txRes = await fetch("/api/invest/transactions", { cache: "no-store", credentials: "include" });
          if (txRes.status === 200) {
            const txBody = await txRes.json().catch(() => null);
            transactions = Array.isArray(txBody?.transactions) ? txBody.transactions.slice(0, 5) : [];
          }
        }
      } catch {
        /* keep the honest zeroed default */
      }

      if (!active) return;
      setData({ signedIn, portfolioValue, cash, todayChange, changeUp, hasDemo, positionCount, brokerStatus, transactions });
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    (async () => {
      const next: Record<string, Quote> = {};
      for (const c of COMPANY_CATALOG.slice(0, 4)) {
        try {
          const res = await fetch(`/api/invest/market/${c.symbol}`, { signal: controller.signal, cache: "no-store" });
          const body = await res.json().catch(() => null);
          const q = body?.quote as Quote | undefined;
          if (active && q && q.price !== null && q.price !== undefined) next[c.symbol] = q;
        } catch {
          /* keep whatever already loaded */
        }
      }
      if (active) setQuotes(next);
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  if (!data) return <Skeleton />;

  const changeUp = data.changeUp;

  return (
    <div className="space-y-6">
      {/* ==== Dashboard hero ==== */}
      <section className="fade-up">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
          {data.signedIn ? "Investment" : "Explore investing"}
        </p>
        <h1 className="mt-1 text-[26px] font-black tracking-tight text-white">
          {data.signedIn ? "Your portfolio" : "Invest in public companies"}
        </h1>

        <NativeCard className="relative mt-4 overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-purple-600/20 blur-[70px]" />
          <Eye>Portfolio value</Eye>
          <p className="mt-1 text-[42px] font-black leading-none tracking-tight text-white">${fmt2(data.portfolioValue)}</p>
          <div className="mt-5 grid grid-cols-2 gap-5 border-t border-white/[0.07] pt-4">
            <Metric label="Available cash" value={`$${fmt2(data.cash)}`} valueClass="text-[22px] text-white" />
            <Metric
              label="Today's change"
              value={`${changeUp ? "+" : "−"}$${fmt2(Math.abs(data.todayChange))}`}
              valueClass={`text-[22px] ${changeUp ? "text-emerald-400" : "text-rose-400"}`}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
            {data.signedIn && (
              <span
                className={`rounded-full px-3 py-1 font-bold ring-1 ${
                  data.brokerStatus === "CONNECTED"
                    ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
                    : "bg-amber-500/10 text-amber-400 ring-amber-500/25"
                }`}
              >
                {data.brokerStatus === "CONNECTED" ? "Brokerage connected" : "Broker integration required"}
              </span>
            )}
          </div>
        </NativeCard>

        {/* Quick actions */}
        <div className="mt-4 grid gap-2.5">
          <div className="grid grid-cols-3 gap-2.5">
            <PrimaryAction href={data.signedIn ? "/invest/deposit" : "/login?next=/invest/deposit"} className="rounded-2xl py-3.5 text-[14px]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
              Deposit
            </PrimaryAction>
            <SecondaryAction href="/invest/markets" className="rounded-2xl py-3.5 text-[14px]">
              <span className="text-sky-400">▲</span> Invest
            </SecondaryAction>
            <SecondaryAction href={data.signedIn ? "/invest/portfolio" : "/login?next=/invest/portfolio"} className="rounded-2xl py-3.5 text-[14px]">
              Portfolio
            </SecondaryAction>
          </div>
          {!data.signedIn && (
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
            const q = quotes[i] ?? quotes[c.symbol];
            const up = (q?.change ?? 0) >= 0;
            const unavailable = q?.source === "unavailable";
            return (
              <Link
                key={c.symbol}
                href={`/invest/markets/${c.symbol}`}
                className="flex items-center gap-3 px-4 py-4 transition active:bg-white/[0.04]"
              >
                <CompanyTile symbol={c.mono} accent={c.accent} />
                <span className="min-w-0 flex-1 py-0.5">
                  <span className="block text-[15px] leading-snug font-bold text-white">{c.name}</span>
                  <span className="mt-1 block text-[12px] leading-snug text-zinc-500">{c.symbol} · {c.exchange}</span>
                </span>
                <span className="shrink-0 text-right">
                  {!q || q.price === null || q.price === undefined || unavailable ? (
                    <span className="text-[12px] text-zinc-600">unavailable</span>
                  ) : (
                    <>
                      <span className="block text-[15px] font-extrabold text-white">${q.price.toFixed(2)}</span>
                      {q.changePct !== null && q.changePct !== undefined && (
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
          {data.signedIn && (
            <Link href="/invest/portfolio" className="text-[13px] font-bold text-sky-400">
              View all
            </Link>
          )}
        </div>
        <NativeCard className="mt-3 divide-y divide-white/[0.06]">
          {!data.signedIn ? (
            <div className="px-5 py-8 text-center">
              <p className="text-[15px] font-bold text-white">No activity yet</p>
              <p className="mt-1 text-[13px] text-zinc-500">
                Your trades and deposits will appear here.
              </p>
            </div>
          ) : data.transactions.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-[15px] font-bold text-white">No activity yet</p>
              <p className="mt-1 text-[13px] text-zinc-500">
                Deposits and completed brokerage executions show up here.
              </p>
            </div>
          ) : (
            data.transactions.map((t) => {
              const incoming = t.direction === "CREDIT";
              const amount = Number(t.amount ?? 0);
              return (
                <div key={t.txnRef} className="flex items-center gap-3 px-4 py-3.5">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[14px] font-black ${
                      incoming ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"
                    }`}
                  >
                    {incoming ? "↓" : "↗"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="block text-[14px] leading-snug font-bold text-white">{t.kind.replace(/[_-]/g, " ")}</p>
                    <p className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                      {t.txnRef} · {new Date(t.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[14px] font-extrabold ${incoming ? "text-emerald-400" : "text-white"}`}>
                    ${amount.toFixed(2)}
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