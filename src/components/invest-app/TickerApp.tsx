"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LineChart, type ChartPoint } from "@/components/invest-app/LineChart";
import type { MarketQuote, QuoteHistory, HistoryRange } from "@/lib/invest/market-data";

const RANGES: HistoryRange[] = ["1D", "1W", "1M", "3M", "1Y", "5Y", "ALL"];
const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];

type Money = { amount: number; label: string };

function fmtMoney(n: number | null | undefined, symbol = "$"): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtVolume(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n.toLocaleString()}`;
}

function verifyColor(v: number | null | undefined): boolean {
  return v === null || v === undefined || v >= 0;
}

function VerifiedBadge() {
  return (
    <svg className="ml-1 inline-block h-4 w-4 shrink-0 text-sky-400" viewBox="0 0 24 24" fill="currentColor" aria-label="Verified company">
      <path d="M12 2l2.4 2.4 3.3-.7.7 3.3L21 9.6l-1.9 3 1.9 2.6L16.9 21l-.9-3.3-2.8.8L12 22l-1.2-3.5-2.8-.8-.9 3.3-3.5-3.1 1.9-2.6L4 9.6l2.6-2.6.7-3.3 3.3.7z" />
      <path d="M8.5 12l2.3 2.3 4.7-4.7" fill="none" stroke="#05060a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Logo({ accent, mono }: { accent: string; mono: string }) {
  return (
    <span
      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[11px] font-black text-white shadow-lg"
      style={{ background: accent }}
    >
      {mono}
    </span>
  );
}

function InfoIcon() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M12 11v5M12 8v.5" />
      </svg>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.06]">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

type TickerAppProps = {
  symbol: string;
  name: string;
  exchange: string;
  sectorTags: string[];
  description: string;
  profileUrl: string;
  accent: string;
  initialQuote: MarketQuote;
  initialHistory: QuoteHistory;
  minAmountUsd: number;
};

export function TickerApp({
  symbol,
  name,
  exchange,
  sectorTags,
  description,
  profileUrl,
  accent,
  initialQuote,
  initialHistory,
  minAmountUsd,
}: TickerAppProps) {
  const [tab, setTab] = useState<string>("Overview");
  const [range, setRange] = useState<HistoryRange>("1D");
  const [quote, setQuote] = useState<MarketQuote>(initialQuote);
  const [history, setHistory] = useState<QuoteHistory>(initialHistory);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  // Client-side cache so switching ranges reuses fetched data instantly
  // instead of hitting the market-data API again for every tab/range flip.
  const historyCache = useRef<Map<string, QuoteHistory>>(
    new Map([[`${symbol}:1D`, initialHistory]]),
  );
  const [amount, setAmount] = useState("");
  const [customChip, setCustomChip] = useState(false);
  const [review, setReview] = useState(false);
  const [orderState, setOrderState] = useState<{ busy: boolean; error: string | null; result: string | null }>({
    busy: false,
    error: null,
    result: null,
  });

  const loadRange = useCallback(
    async (sym: string, r: HistoryRange, signalAbort?: AbortSignal) => {
      setLoadingHistory(true);
      setHistoryError(false);
      try {
        const res = await fetch(`/api/invest/market/${sym}?range=${r}`, { signal: signalAbort });
        const data = (await res.json().catch(() => ({}))) as {
          quote?: MarketQuote;
          history?: QuoteHistory;
        };
        if (signalAbort?.aborted) return false;
        if (data.quote && data.quote.price !== null && data.quote.source === "live") setQuote(data.quote);
        if (data.history && data.history.points && data.history.points.length > 0) {
          historyCache.current.set(`${sym}:${r}`, data.history);
          setHistory(data.history);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setLoadingHistory(false);
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    const cached = historyCache.current.get(`${symbol}:${range}`);
    if (cached && cached.points.length > 0) {
      setHistory(cached);
      setLoadingHistory(false);
      return () => undefined;
    }
    (async () => {
      const ok = await loadRange(symbol, range, abort.signal);
      if (!active) return;
      if (!ok) {
        setHistoryError(true);
        // One automatic retry after a short delay — covers transient upstream
        // "no data"/rate-limit responses without faking chart values.
        setTimeout(() => {
          if (!active) return;
          void loadRange(symbol, range).then((retried) => {
            if (!active) return;
            setHistoryError(!retried);
          });
        }, 1500);
      }
    })();
    return () => {
      active = false;
      abort.abort();
    };
  }, [symbol, range, loadRange]);

  // Retry button for the "couldn't load chart" state.
  const [retryTick, setRetryTick] = useState(0);
  const retryRange = useCallback(() => {
    historyCache.current.delete(`${symbol}:${range}`);
    setRetryTick((t) => t + 1);
  }, [symbol, range]);
  useEffect(() => {
    if (retryTick === 0) return;
    let active = true;
    const abort = new AbortController();
    void loadRange(symbol, range, abort.signal).then((ok) => {
      if (!active) return;
      if (!ok) setHistoryError(true);
    });
    return () => {
      active = false;
      abort.abort();
    };
  }, [retryTick, symbol, range, loadRange]);

  const price = quote?.price ?? null;
  const change = quote?.change ?? null;
  const changePct = quote?.changePct ?? null;
  const up = verifyColor(change);

  const amountNum = Number(amount);
  const amountValid = amount.trim() !== "" && Number.isFinite(amountNum) && amountNum >= minAmountUsd;
  const estimatedShares = price && amountValid ? amountNum / price : null;
  const demo = quote?.source === "dev-mock";
  const unavailable = quote?.source === "unavailable";

  const setChip = (v: number) => {
    setAmount(String(v));
    setCustomChip(false);
    setReview(false);
  };

  const rangeLabel = useMemo(
    () =>
      history?.points.length
        ? history.points[0].time.includes("T")
          ? history.points[0].time.slice(0, 10)
          : history.points[0].time
        : "",
    [history],
  );

  const buyNow = useCallback(async () => {
    if (!amountValid || price === null) return;
    setOrderState({ busy: true, error: null, result: null });
    try {
      const res = await fetch("/api/invest/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          amountCents: Math.round(amountNum * 100),
          orderType: "MARKET",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setOrderState({ busy: false, error: null, result: "Please sign in to place an order." });
        return;
      }
      if (!res.ok) {
        setOrderState({ busy: false, error: data.error ?? "Order could not be placed.", result: null });
        return;
      }
      setOrderState({ busy: false, error: null, result: data.status ?? "Order rejected" });
    } catch {
      setOrderState({ busy: false, error: "Could not reach the server.", result: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountValid, price, amountNum, symbol]);

  const TABS = ["Overview", "Chart", "Financials", "News", "About"];

  return (
    <div className="space-y-5">
      {/* ===== COMPANY HEADER ===== */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Logo accent={accent} mono={symbol} />
          <div className="min-w-0 pt-0.5">
            <h1 className="flex items-center text-[17px] font-extrabold tracking-tight text-white">
              {name}
              <VerifiedBadge />
            </h1>
            <p className="mt-0.5 text-[13px] font-semibold text-zinc-400">
              {symbol} <span className="text-zinc-600">·</span> {exchange}
            </p>
            <p className="mt-1 text-[11px] font-medium text-zinc-500">{sectorTags.join(" · ")}</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-400">{description}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {unavailable ? (
            <p className="text-[13px] font-semibold text-zinc-500">Market data unavailable</p>
          ) : (
            <>
              <p className={`text-xl font-extrabold tracking-tight ${demo ? "text-zinc-300" : "text-white"}`}>
                ${price !== null ? price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
              </p>
              {change !== null && changePct !== null ? (
                <p className={`mt-0.5 flex items-center justify-end gap-1 text-[13px] font-bold ${up ? "text-emerald-400" : "text-rose-400"}`}>
                  <span>{up ? "▲" : "▼"}</span>
                  {change > 0 ? "+" : ""}
                  {change.toFixed(2)} ({changePct > 0 ? "+" : ""}
                  {changePct.toFixed(2)}%)
                </p>
              ) : null}
              <p className="mt-0.5 text-[10px] font-medium text-zinc-600">Real-time price · USD</p>
            </>
          )}
        </div>
      </div>

      {demo && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-widest text-amber-400 ring-1 ring-amber-500/20">
          DEV DATA · NOT LIVE — no live provider key configured
        </p>
      )}

      {/* ===== TABS ===== */}
      <div className="-mx-4 border-b border-white/[0.06] px-4">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative shrink-0 px-3 py-2.5 text-[13px] font-semibold transition ${
                tab === t ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t}
              {tab === t && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-sky-500" />}
            </button>
          ))}
        </div>
      </div>

      {/* ===== CHART + STATS ===== */}
      {tab === "Overview" || tab === "Chart" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-[#0a0d13] p-4 ring-1 ring-white/[0.07]">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    range === r
                      ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="mb-1 text-[11px] font-semibold text-zinc-500">
              {rangeLabel || "Range"} {loadingHistory && <span className="text-zinc-600">· loading…</span>}
            </p>
            {history?.points && history.points.length > 0 ? (
              <LineChart points={history.points} height={224} />
            ) : loadingHistory ? (
              <div className="grid h-56 w-full place-items-center rounded-xl bg-white/[0.02] text-sm text-zinc-500">
                Loading chart data…
              </div>
            ) : historyError ? (
              <div className="grid h-56 w-full place-items-center rounded-xl bg-white/[0.02] text-sm text-zinc-500">
                <div className="flex flex-col items-center gap-3">
                  <span>Chart data temporarily unavailable</span>
                  <button
                    type="button"
                    onClick={retryRange}
                    className="rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-1.5 text-[12px] font-bold text-sky-400 transition hover:bg-sky-500/20"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid h-56 w-full place-items-center rounded-xl bg-white/[0.02] text-sm text-zinc-500">
                No chart data for this range
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-[#0a0d13] p-4 ring-1 ring-white/[0.07]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Key Statistics</p>
            <div className="mt-3 grid gap-2">
              <Stat label="Market Cap" value={fmtCompact(quote?.marketCap)} />
              <Stat
                label="Day's Range"
                value={
                  quote?.dayLow && quote?.dayHigh ? `${fmtMoney(quote.dayLow)} – ${fmtMoney(quote.dayHigh)}` : "—"
                }
              />
              <Stat
                label="52 Week Range"
                value={
                  quote?.w52Low && quote?.w52High ? `${fmtMoney(quote.w52Low)} – ${fmtMoney(quote.w52High)}` : "—"
                }
              />
              <Stat label="Volume" value={fmtVolume(quote?.volume)} />
              <Stat label="P/E Ratio" value={quote?.peRatio !== null && quote?.peRatio !== undefined ? String(quote.peRatio) : "N/A"} />
            </div>
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 text-[12px] font-bold text-sky-400 ring-1 ring-white/[0.07] transition hover:bg-white/[0.07]"
            >
              View on {exchange}
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6v6M10 14L20 4" />
              </svg>
            </a>
          </div>
        </div>
      ) : null}

      {/* ===== FINANCIALS / NEWS / ABOUT ===== */}
      {tab === "Financials" ? (
        <div className="rounded-2xl bg-[#0a0d13] p-4 ring-1 ring-white/[0.07]">
          <p className="text-sm font-bold text-white">Financials</p>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
            Detailed financial statements require a premium market-data plan and are not yet enabled on this account.
          </p>
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-sky-400"
          >
            View official financial data on {exchange} ›
          </a>
        </div>
      ) : null}

      {tab === "News" ? (
        <div className="rounded-2xl bg-[#0a0d13] p-4 ring-1 ring-white/[0.07]">
          <p className="text-sm font-bold text-white">News</p>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
            Company news is sourced from official market listings and is not generated or rewritten by CelebrityPass.
          </p>
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-sky-400"
          >
            Read latest headlines on {exchange} ›
          </a>
        </div>
      ) : null}

      {tab === "About" ? (
        <div className="rounded-2xl bg-[#0a0d13] p-4 ring-1 ring-white/[0.07]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">About</p>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">{description}</p>
          <p className="mt-3 text-[12px] font-semibold text-zinc-500">{sectorTags.join(" · ")}</p>
          <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
            {name} ({symbol}) is a publicly traded company listed on {exchange}. CelebrityPass shows company information
            as a service to investors and does not imply any endorsement by the company.
          </p>
        </div>
      ) : null}

      {/* ===== HOW IT WORKS ===== */}
      {tab === "Overview" ? (
        <>
          <div className="flex items-start gap-3 rounded-2xl border border-sky-500/25 bg-sky-500/[0.08] p-4">
            <InfoIcon />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">How it works?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">
                CelebrityPass provides market information and, where available, connects users to an authorized
                brokerage/custody provider for the purchase of eligible securities.
              </p>
            </div>
            <Link href="/invest/more" className="shrink-0 text-[12px] font-bold text-sky-400">
              Learn more ›
            </Link>
          </div>

          {/* ===== INVEST CARD ===== */}
          <div className="rounded-2xl bg-[#0a0d13] p-4 ring-1 ring-white/[0.07]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-[16px] font-extrabold tracking-tight text-white">
                  Invest in {name.split(",")[0]} ({symbol})
                </h2>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
                  Choose an amount to explore {symbol} shares. Your estimated quantity is calculated using the current
                  market price.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-sky-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-sky-400 ring-1 ring-sky-500/30">
                {unavailable ? "Broker integration required" : "Market data ready"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
              <div>
                <label className="block text-[12px] font-semibold text-zinc-400">
                  Investment amount (USD)
                  <input
                    type="number"
                    inputMode="decimal"
                    min={minAmountUsd}
                    step="0.01"
                    placeholder="$1,000.00"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setCustomChip(true);
                      setReview(false);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-lg font-extrabold text-white outline-none transition focus:border-sky-500/60"
                  />
                </label>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {CHIP_AMOUNTS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setChip(v)}
                      className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${
                        !customChip && amount === String(v)
                          ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/50"
                          : "bg-white/[0.04] text-zinc-400 ring-1 ring-white/[0.07] hover:text-white"
                      }`}
                    >
                      {v === 1000 ? "$1K" : `$${v.toLocaleString()}`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setAmount("");
                      setCustomChip(true);
                      setReview(false);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${
                      customChip ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/50" : "bg-white/[0.04] text-zinc-400 ring-1 ring-white/[0.07] hover:text-white"
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.07] lg:min-w-[180px]">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Estimated shares
                  <svg className="h-3 w-3 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 11v5M12 8v.5" />
                  </svg>
                </p>
                <p className="mt-1 text-xl font-extrabold text-white">
                  {estimatedShares !== null && price !== null && amountValid
                    ? `${estimatedShares.toFixed(4)}`
                    : "—"}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-zinc-500">
                  {price !== null ? `Based on $${price.toFixed(2)} per share` : "Price unavailable"} · minimum ${minAmountUsd}
                </p>
              </div>
            </div>

            {review ? (
              <div className="mt-4 space-y-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.07]">
                <p className="text-sm font-bold text-white">Review your order</p>
                <div className="grid gap-1.5 text-[13px]">
                  {[
                    ["Asset", name],
                    ["Ticker", symbol],
                    ["Exchange", exchange],
                    ["Order type", "Market Order"],
                    ["Investment amount", `$${(amountNum || 0).toFixed(2)}`],
                    ["Estimated price", price !== null ? `$${price.toFixed(2)}` : "—"],
                    ["Estimated shares", estimatedShares !== null ? estimatedShares.toFixed(4) : "—"],
                    ["Estimated fees", "$0.00"],
                    ["Total", `$${(amountNum || 0).toFixed(2)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3">
                      <span className="text-zinc-500">{k}</span>
                      <span className="font-semibold text-white">{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-600">
                  Market prices can change before execution. No order is placed without your confirmation.
                </p>
                {orderState.result ? (
                  <div className="rounded-xl bg-rose-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-rose-300">
                    {orderState.result === "Please sign in to place an order." ? (
                      <>
                        {orderState.result}{" "}
                        <Link href="/login?next=/invest/markets/TSLA" className="font-bold text-sky-400 underline underline-offset-2">
                          Sign in
                        </Link>
                      </>
                    ) : (
                      <>
                        {orderState.result}{" "}
                        <span className="font-semibold text-zinc-300">
                          — no purchase was executed. This order cannot complete until a brokerage connection exists.
                        </span>
                      </>
                    )}
                  </div>
                ) : null}
                {orderState.error ? (
                  <p className="rounded-xl bg-rose-500/10 px-3 py-2.5 text-[12px] text-rose-300">{orderState.error}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={orderState.busy || price === null}
                    onClick={buyNow}
                    className="btn-grad rounded-full px-6 py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {orderState.busy ? "Submitting…" : "Confirm Order"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReview(false)}
                    className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/5"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!amountValid || price === null}
                  onClick={() => setReview(true)}
                  className="btn-grad w-full rounded-full px-6 py-3.5 text-[15px] font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Review and Buy
                </button>
              </div>
            )}

            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <svg className="h-3.5 w-3.5 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" />
              </svg>
              Your payment details are encrypted and processed securely. Purchases are only executed through an authorized
              brokerage connection.
            </p>
          </div>

          {/* ===== TRUST CARDS ===== */}
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.06]">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/15 text-sky-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M4 20V10m5 10V4m5 16v-8m5 8V7" />
                </svg>
              </span>
              <p className="mt-2 text-[13px] font-bold text-white">Real Ownership</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                Ownership is not created until an authorized brokerage transaction is completed.
              </p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.06]">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/15 text-sky-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <p className="mt-2 text-[13px] font-bold text-white">Brokerage &amp; Custody</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                Orders and custody are handled by our authorized provider once connected.
              </p>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.06]">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/15 text-sky-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h13a2 2 0 012 2v12a2 2 0 01-2 2H4V5z" />
                  <path strokeLinecap="round" d="M7 9h6m-6 4h4" />
                </svg>
              </span>
              <p className="mt-2 text-[13px] font-bold text-white">Transparent</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                View orders, holdings, execution details and performance from your account.
              </p>
            </div>
          </div>

          {/* ===== RISK ===== */}
          <div className="flex items-start gap-3 rounded-2xl bg-white/[0.02] px-4 py-3.5 ring-1 ring-white/[0.06]">
            <span className="mt-0.5 shrink-0 text-zinc-600">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 11v5M12 8v.5" />
              </svg>
            </span>
            <p className="flex-1 text-[11px] leading-relaxed text-zinc-500">
              Investing involves risk. The value of an investment can go down as well as up. Past performance does not
              guarantee future results. Review the applicable risk disclosures and terms before investing.
            </p>
            <Link href="/invest/more" className="shrink-0 text-[11px] font-bold text-sky-400">
              View details ›
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}