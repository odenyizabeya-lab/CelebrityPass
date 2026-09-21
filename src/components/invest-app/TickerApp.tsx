"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";
import { LineChart } from "@/components/invest-app/LineChart";
import type { MarketQuote, QuoteHistory, HistoryRange, MarketPhase } from "@/lib/invest/market-data";
import { useWatchlist, WatchStar } from "@/components/invest-app/Watchlist";
import { Eye, NativeCard, AssetLogo } from "@/components/invest-app/native";
import { PaymentMethodsSheet } from "@/components/invest-app/PaymentMethodsSheet";

const RANGES: HistoryRange[] = ["1D", "1W", "1M", "3M", "1Y", "5Y", "ALL"];
const CHIP_AMOUNTS = [100, 500, 1000, 5000, 10000];

type LiveStatusType = "live" | "pre" | "post" | "closed" | "updating" | "unavailable" | "demo";

function phaseToStatus(phase: MarketPhase | null): LiveStatusType {
  switch (phase) {
    case "PRE":
      return "pre";
    case "POST":
      return "post";
    case "REGULAR":
      return "live";
    default:
      return "closed";
  }
}

// Real-time polling cadence — stays well inside the market-data plan limits.
const LIVE_OPEN_MS = 15_000; // market open: poll the live endpoint
const LIVE_PRE_MS = 30_000; // pre-market: prices move, watch them
const LIVE_POST_MS = 60_000; // after-hours: prices move more slowly
const LIVE_CLOSED_MS = 5 * 60_000; // market closed: slow down, price is static
const LIVE_RETRY_MS = 30_000; // transient failure: retry quickly but never spam
const ANIMATION_MS = 900;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Smoothly counts the displayed number from the previous confirmed value to
 * the new confirmed value. Only runs when the target actually changes; when
 * the API reports the same price nothing moves.
 */
function useAnimatedPrice(target: number | null): number | null {
  const [value, setValue] = useState<number | null>(target);
  const fromRef = useRef<number | null>(target);
  const raf = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    if (target === null) {
      fromRef.current = null;
      return;
    }
    const from = fromRef.current ?? target;
    fromRef.current = target;
    if (from === target) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      setValue(from + (target - from) * easeOutCubic(t));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);

  return value;
}

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

function fmtLastUpdated(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Subtle, honest connection pill next to the price:
 *  - market open + live feed  -> pulsing ● Live
 *  - pre-market               -> "Pre-market · HH:MM"
 *  - after-hours              -> "After hours · HH:MM"
 *  - market closed            -> "Market closed · Last updated HH:MM"
 *  - transient failure        -> "Updating…" (last confirmed price stays)
 *  - no provider              -> "Market data unavailable"
 *  - dev/mock builds          -> "Demo data" (never claims to be real-time)
 */
function LiveStatus({ status, lastUpdated }: { status: string; lastUpdated: string | null }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ring-1";
  if (status === "live") {
    return (
      <span className={`${base} bg-emerald-500/10 text-emerald-400 ring-emerald-500/30`}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        Live
      </span>
    );
  }
  if (status === "pre" || status === "post") {
    return (
      <span className={`${base} bg-sky-500/10 text-sky-300 ring-sky-500/30`}>
        <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
        {status === "pre" ? "Pre-market" : "After hours"} · {fmtLastUpdated(lastUpdated)}
      </span>
    );
  }
  if (status === "closed") {
    return (
      <span className={`${base} bg-white/[0.04] text-zinc-400 ring-white/[0.08]`}>
        <span className="h-2 w-2 rounded-full bg-zinc-500" />
        Market closed · {fmtLastUpdated(lastUpdated)}
      </span>
    );
  }
  if (status === "updating") {
    return (
      <span className={`${base} bg-white/[0.04] text-amber-300 ring-amber-400/25`}>
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
        Updating…
      </span>
    );
  }
  if (status === "demo") {
    return (
      <span className={`${base} bg-amber-500/10 text-amber-400 ring-amber-500/30`}>
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        Demo data
      </span>
    );
  }
  return (
    <span className={`${base} bg-white/[0.04] text-zinc-500 ring-white/[0.08]`}>
      <span className="h-2 w-2 rounded-full bg-zinc-500" />
      Market data unavailable
    </span>
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
  const { symbols: watchSymbols, toggle: toggleWatch } = useWatchlist();
  const [history, setHistory] = useState<QuoteHistory>(initialHistory);
  // Mirrors `range` for use inside stable callbacks (live chart appends).
  const rangeRef = useRef<HistoryRange>("1D");
  useEffect(() => {
    rangeRef.current = range;
  }, [range]);
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
  // Account funding state: the real admin-verified cash balance (null while
  // unknown/signed-out) + whether a payment was just submitted for review.
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [paySheet, setPaySheet] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);

  const refreshBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/invest/account", { cache: "no-store" });
      if (res.status === 401) {
        setAvailableBalance(null);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as { balances?: { cash?: string | number } };
      const cash = Number(data?.balances?.cash);
      setAvailableBalance(Number.isFinite(cash) ? cash : null);
    } catch {
      /* keep whatever we had */
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/invest/account", { cache: "no-store" });
        if (!active) return;
        if (res.status === 401) {
          setAvailableBalance(null);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as { balances?: { cash?: string | number } };
        const cash = Number(data?.balances?.cash);
        if (active) setAvailableBalance(Number.isFinite(cash) ? cash : null);
      } catch {
        /* signed-out or network — leave balance unset */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Real-time state: the displayed price is animated toward the latest
  // confirmed value; the pipe state tells us what to show next to it.
  const [liveStatus, setLiveStatus] = useState<LiveStatusType>(() => {
    if (initialQuote.source === "dev-mock") return "demo";
    if (initialQuote.source !== "live") return "unavailable";
    return phaseToStatus(initialQuote.marketPhase ?? (initialQuote.isMarketOpen === false ? "CLOSED" : "REGULAR"));
  });
  const animatePrice = useAnimatedPrice(quote?.price ?? null);

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

  // When a fresh confirmed price arrives for the intraday range, add (or
  // replace) the latest history point so the chart follows the real tape.
  // Non-intraday ranges ignore intraday ticks — only 1D/1W are redrawn live.
  const appendLivePoint = useCallback(
    (q: MarketQuote) => {
      if (rangeRef.current !== "1D" && rangeRef.current !== "1W") return;
      if (q.price === null) return;
      const livePrice: number = q.price;
      setHistory((prev) => {
        if (!prev || prev.points.length === 0) return prev;
        const last = prev.points[prev.points.length - 1];
        if (last.price === livePrice && prev.fetchedAt) return prev; // genuinely unchanged
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
        const lastStamp = last.time.includes("T") ? last.time.slice(0, 16) : last.time;
        const sameMinute = stamp.slice(0, 16) === lastStamp.slice(0, 16);
        const points = sameMinute
          ? [...prev.points.slice(0, -1), { ...last, price: livePrice }]
          : [...prev.points.slice(-1000), { time: stamp, price: livePrice }];
        return { ...prev, points };
      });
    },
    [],
  );

  // Keep the freshest confirmed quote and intraday chart fed from the API.
  // Polls the live endpoint on a cadence that stays inside the market-data
  // plan limits and reacts to market open/closed + transient failures.
  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = (delayMs: number) => {
      if (!active) return;
      pollTimer = setTimeout(() => void poll(), delayMs);
    };

    const poll = async () => {
      controller = new AbortController();
      try {
        const res = await fetch(`/api/invest/market/${symbol}/live`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const data = (await res.json().catch(() => ({}))) as { quote?: MarketQuote };
        if (!active || !data.quote) throw new Error("no-quote");

        const q = data.quote;
        if (q.price === null || q.source === "unavailable") {
          // Upstream had nothing new: keep the last confirmed price, never fake.
          setLiveStatus((prev) => (prev === "live" || prev === "closed" ? "updating" : "unavailable"));
          scheduleNext(LIVE_RETRY_MS);
          return;
        }
        if (q.source === "live") {
          setQuote(q);
          const phase = q.marketPhase ?? (q.isMarketOpen === false ? "CLOSED" : "REGULAR");
          const st = phaseToStatus(phase);
          setLiveStatus(st);
          appendLivePoint(q);
          scheduleNext(
            st === "pre" ? LIVE_PRE_MS : st === "post" ? LIVE_POST_MS : st === "closed" ? LIVE_CLOSED_MS : LIVE_OPEN_MS,
          );
          return;
        }
        // dev-mock (explicit demo builds only) — still show the demo banner.
        setQuote(q);
        setLiveStatus("demo");
        scheduleNext(LIVE_OPEN_MS);
      } catch {
        if (!active) return;
        setLiveStatus((prev) => (prev === "live" || prev === "closed" ? "updating" : "unavailable"));
        scheduleNext(LIVE_RETRY_MS);
      }
    };

    pollTimer = setTimeout(() => void poll(), 2_000); // start shortly after mount
    return () => {
      active = false;
      controller?.abort();
      if (pollTimer) clearTimeout(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

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
    (async () => {
      const ok = await loadRange(symbol, range, abort.signal);
      if (!active) return;
      if (!ok) setHistoryError(true);
    })();
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
    setPaymentSubmitted(false);
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

  // Funding: with a known (admin-verified) balance we proactively route an
  // under-funded order to the Payment Methods sheet instead of a dead-end
  // "Insufficient available balance" error screen.
  const insufficient = availableBalance !== null && amountValid && amountNum > availableBalance + 0.005;

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
      // The balance fell short server-side (or the cached balance went stale):
      // never make the user stare at a funds error — take them straight to the
      // dedicated Payment Methods screen to fund the order.
      if (res.status === 402) {
        setOrderState({ busy: false, error: null, result: null });
        void refreshBalance();
        setPaySheet(true);
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
  }, [amountValid, price, amountNum, symbol, refreshBalance]);

  const TABS = ["Overview", "Chart", "Financials", "News", "About"];

  return (
    <div className="space-y-6">
      {/* ===== COMPANY HEADER ===== */}
      <section className="fade-up flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AssetLogo ticker={symbol} accent={accent} className="h-14 w-14 shrink-0 rounded-2xl text-[13px]" />
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 text-[20px] font-black tracking-tight text-white">
              <span className="min-w-0 break-words">{name}</span>
              <VerifiedBadge className="h-4 w-4 shrink-0" />
            </h1>
            <p className="mt-0.5 text-[13px] font-semibold text-zinc-400">
              {symbol} <span className="text-zinc-600">·</span> {exchange} · {sectorTags[0]}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label={watchSymbols.includes(symbol) ? "Remove from watchlist" : "Add to watchlist"}
          onClick={() => toggleWatch(symbol)}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.05] ring-1 ring-white/[0.07] transition active:scale-90 active:bg-white/[0.1]"
        >
          <WatchStar symbol={symbol} on={watchSymbols.includes(symbol)} />
        </button>
      </section>

      {/* ===== PRICE HERO ===== */}
      <section className="fade-up">
        <Eye>Market price · USD</Eye>
        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-3">
          <p
            className={`text-[46px] font-black leading-none tracking-tight tabular-nums ${
              demo ? "text-zinc-300" : "text-white"
            }`}
          >
            {price !== null ? `${fmtMoney(animatePrice !== null ? animatePrice : price)}` : "—"}
          </p>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {change !== null && changePct !== null ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-[16px] font-black ring-1 ${
                  up ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/25" : "bg-rose-500/10 text-rose-400 ring-rose-500/25"
                }`}
              >
                <span>{up ? "▲" : "▼"}</span>
                {change > 0 ? "+" : ""}
                {change.toFixed(2)} ({changePct > 0 ? "+" : ""}
                {changePct.toFixed(2)}%)
              </span>
            ) : null}
            <LiveStatus status={liveStatus} lastUpdated={quote?.marketTime ?? quote?.fetchedAt} />
          </div>
        </div>
        {description && (
          <p className="mt-3 text-[13px] leading-relaxed text-zinc-400">{description}</p>
        )}
      </section>

      {demo && (
        <p className="rounded-2xl bg-amber-500/10 px-4 py-3 text-center text-[12px] font-black uppercase tracking-widest text-amber-400 ring-1 ring-amber-500/20">
          DEV DATA · NOT LIVE — no live provider key configured
        </p>
      )}

      {/* ===== TABS ===== */}
      <div className="sticky top-[64px] z-30 -mx-4 border-b border-white/[0.06] bg-[#05060a]/95 px-4 py-2 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-xl gap-1.5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-extrabold transition active:scale-95 ${
                tab === t
                  ? "bg-white text-ink-950"
                  : "bg-white/[0.04] text-zinc-400 ring-1 ring-white/[0.07] active:bg-white/[0.08]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ===== CHART + STATS ===== */}
      {tab === "Overview" || tab === "Chart" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <NativeCard className="p-4">
            <div className="mb-3 grid grid-cols-7 gap-1.5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-xl px-0 py-2.5 text-[13px] font-black transition active:scale-95 ${
                    range === r
                      ? "bg-sky-500/25 text-sky-300 ring-1 ring-sky-500/50"
                      : "bg-white/[0.04] text-zinc-400 ring-1 ring-white/[0.06] active:bg-white/[0.08]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              {rangeLabel || "Range"} {loadingHistory && <span className="ml-1 text-zinc-600">loading…</span>}
            </p>
            {history?.points && history.points.length > 0 ? (
              <LineChart points={history.points} height={300} />
            ) : loadingHistory ? (
              <div className="grid h-72 w-full place-items-center rounded-2xl bg-white/[0.02] text-sm text-zinc-500">
                Loading chart data…
              </div>
            ) : historyError ? (
              <div className="grid h-72 w-full place-items-center rounded-2xl bg-white/[0.02] text-sm text-zinc-500">
                <div className="flex flex-col items-center gap-3">
                  <span>Chart data temporarily unavailable</span>
                  <button
                    type="button"
                    onClick={retryRange}
                    className="rounded-full border border-sky-500/40 bg-sky-500/10 px-5 py-2 text-[13px] font-bold text-sky-400 transition hover:bg-sky-500/20"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid h-72 w-full place-items-center rounded-2xl bg-white/[0.02] text-sm text-zinc-500">
                No chart data for this range
              </div>
            )}
          </NativeCard>

          <NativeCard className="p-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-zinc-500">Key statistics</p>
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
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-3 text-[13px] font-bold text-sky-400 ring-1 ring-white/[0.07] transition hover:bg-white/[0.07]"
            >
              View on {exchange}
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6v6M10 14L20 4" />
              </svg>
            </a>
          </NativeCard>
        </div>
      ) : null}

      {/* ===== FINANCIALS / NEWS / ABOUT ===== */}
      {tab === "Financials" ? (
        <NativeCard className="p-5">
          <p className="text-[16px] font-extrabold text-white">Financials</p>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
            Detailed financial statements require a premium market-data plan and are not yet enabled on this account.
          </p>
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-sky-400"
          >
            View official financial data on {exchange} ›
          </a>
        </NativeCard>
      ) : null}

      {tab === "News" ? (
        <NativeCard className="p-5">
          <p className="text-[16px] font-extrabold text-white">News</p>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
            Company news is sourced from official market listings and is not generated or rewritten by CelebrityPass.
          </p>
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-sky-400"
          >
            Read latest headlines on {exchange} ›
          </a>
        </NativeCard>
      ) : null}

      {tab === "About" ? (
        <NativeCard className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">About</p>
          <p className="mt-2 text-[14px] leading-relaxed text-zinc-300">{description}</p>
          <p className="mt-3 text-[13px] font-semibold text-zinc-500">{sectorTags.join(" · ")}</p>
          <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
            {name} ({symbol}) is a publicly traded company listed on {exchange}. CelebrityPass shows company information
            as a service to investors and does not imply any endorsement by the company.
          </p>
        </NativeCard>
      ) : null}

      {/* ===== HOW IT WORKS ===== */}
      {tab === "Overview" ? (
        <>
          <NativeCard className="flex items-start gap-3 border border-sky-500/25 bg-sky-500/[0.08] p-4 ring-sky-500/20">
            <InfoIcon />
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold text-white">How it works?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-300">
                CelebrityPass provides market information and, where available, connects users to an authorized
                brokerage/custody provider for the purchase of eligible securities.
              </p>
            </div>
            <Link href="/invest/more" className="shrink-0 text-[13px] font-bold text-sky-400">
              Learn more ›
            </Link>
          </NativeCard>

          {/* ===== INVEST CARD ===== */}
          <NativeCard className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-[19px] font-black tracking-tight text-white">
                  Invest in {name.split(",")[0]} ({symbol})
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">
                  Choose an amount to explore {symbol} shares. Your estimated quantity is calculated using the current
                  market price.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-sky-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-sky-400 ring-1 ring-sky-500/30">
                {unavailable ? "Market data unavailable" : "Market info only"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
              <div>
                <label className="block text-[13px] font-semibold text-zinc-300">
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
                      setPaymentSubmitted(false);
                    }}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-[24px] font-black tracking-tight text-white outline-none transition focus:border-sky-500/60"
                  />
                </label>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {CHIP_AMOUNTS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setChip(v)}
                      className={`rounded-2xl px-2 py-3 text-[14px] font-black transition active:scale-95 ${
                        !customChip && amount === String(v)
                          ? "bg-sky-500/25 text-sky-300 ring-1 ring-sky-500/50"
                          : "bg-white/[0.04] text-zinc-300 ring-1 ring-white/[0.07] active:bg-white/[0.08]"
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
                      setPaymentSubmitted(false);
                    }}
                    className={`rounded-2xl px-2 py-3 text-[14px] font-black transition active:scale-95 ${
                      customChip ? "bg-sky-500/25 text-sky-300 ring-1 ring-sky-500/50" : "bg-white/[0.04] text-zinc-300 ring-1 ring-white/[0.07] active:bg-white/[0.08]"
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white/[0.03] px-4 py-3.5 ring-1 ring-white/[0.07] lg:min-w-[190px]">
                <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                  Estimated shares
                  <svg className="h-3 w-3 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 11v5M12 8v.5" />
                  </svg>
                </p>
                <p className="mt-1.5 text-[26px] font-black tracking-tight text-white">
                  {estimatedShares !== null && price !== null && amountValid
                    ? `${estimatedShares.toFixed(4)}`
                    : "—"}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-zinc-500">
                  {price !== null ? `Based on $${price.toFixed(2)} per share` : "Price unavailable"} · minimum ${minAmountUsd}
                </p>
              </div>
            </div>

            {review ? (
              <div className="mt-4 space-y-3 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 ring-1 ring-white/[0.08]">
                <p className="text-[16px] font-black text-white">Review your order</p>
                <div className="grid gap-2 text-[14px]">
                  {[
                    ["Asset", name],
                    ["Ticker", symbol],
                    ["Exchange", exchange],
                    ["Order type", "Market Order"],
                    ["Investment amount", `$${(amountNum || 0).toFixed(2)}`],
                    ["Available balance", availableBalance !== null ? fmtMoney(availableBalance) : "—"],
                    ["Estimated price", price !== null ? `$${price.toFixed(2)}` : "—"],
                    ["Estimated shares", estimatedShares !== null ? estimatedShares.toFixed(4) : "—"],
                    ["Estimated fees", "$0.00"],
                    ["Total", `$${(amountNum || 0).toFixed(2)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-0 last:pb-0">
                      <span className="text-zinc-500">{k}</span>
                      <span className="font-bold text-white">{v}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-zinc-600">
                  Market prices can change before execution. No order is placed without your confirmation.
                </p>
                {paymentSubmitted ? (
                  <div className="rounded-2xl bg-amber-400/10 px-4 py-3 ring-1 ring-amber-400/30">
                    <p className="flex items-center gap-2 text-[13px] font-bold text-amber-300">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                      Payment submitted — awaiting verification
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
                      Your available balance is credited once an admin confirms your transfer. You can finish this order
                      right here once the funds are available.
                    </p>
                  </div>
                ) : insufficient ? (
                  <div className="rounded-2xl bg-amber-400/10 px-4 py-3 ring-1 ring-amber-400/30">
                    <p className="flex items-center gap-2 text-[13px] font-bold text-amber-300">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      Add funds to complete this order
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
                      Your available balance is {fmtMoney(availableBalance)}. Top up with a bank transfer or ATM payment
                      — your balance updates after verification.
                    </p>
                  </div>
                ) : null}
                {orderState.result ? (
                  <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-[13px] leading-relaxed text-rose-300">
                    {orderState.result === "Please sign in to place an order." ? (
                      <>
                        {orderState.result}{" "}
                        <Link href={`/login?next=/invest/markets/${symbol}`} className="font-bold text-sky-400 underline underline-offset-2">
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
                  <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-[13px] text-rose-300">{orderState.error}</p>
                ) : null}
                <div className="mt-4 grid gap-2.5">
                  <button
                    type="button"
                    disabled={orderState.busy || price === null}
                    onClick={insufficient ? () => setPaySheet(true) : buyNow}
                    className="btn-grad flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[16px] font-black tracking-wide text-white shadow-xl shadow-primary-600/25 transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {orderState.busy
                      ? "Submitting…"
                      : insufficient
                        ? "Add Funds / Make Payment"
                        : "Confirm Order"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReview(false)}
                    className="w-full rounded-2xl border border-white/15 bg-white/[0.04] py-4 text-[15px] font-bold text-zinc-200 transition active:scale-[0.98]"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <button
                  type="button"
                  disabled={!amountValid || price === null}
                  onClick={() => setReview(true)}
                  className="btn-grad w-full rounded-2xl py-4 text-[16px] font-black tracking-wide text-white shadow-xl shadow-primary-600/25 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Review and Buy
                </button>
                {availableBalance !== null && amountValid && insufficient && (
                  <p className="mt-2.5 rounded-2xl bg-amber-400/10 px-4 py-2.5 text-center text-[12px] font-semibold text-amber-300 ring-1 ring-amber-400/30">
                    Available balance {fmtMoney(availableBalance)} — you&apos;ll be able to add funds when you review this order.
                  </p>
                )}
              </div>
            )}

            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <svg className="h-3.5 w-3.5 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" />
              </svg>
              Your payment details are encrypted and processed securely. Purchases are only executed through an authorized
              brokerage connection.
            </p>
          </NativeCard>

          {/* ===== TRUST CARDS ===== */}
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3.5 ring-1 ring-white/[0.08]">
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
            <div className="rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3.5 ring-1 ring-white/[0.08]">
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
            <div className="rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3.5 ring-1 ring-white/[0.08]">
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

      {paySheet ? (
        <PaymentMethodsSheet
          symbol={symbol}
          companyName={name}
          amountCents={Math.round(amountNum * 100)}
          onClose={() => setPaySheet(false)}
          onPaymentSubmitted={() => {
            setPaymentSubmitted(true);
            void refreshBalance();
          }}
        />
      ) : null}
    </div>
  );
}