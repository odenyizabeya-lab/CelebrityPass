"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketQuote } from "@/lib/invest/market-data";

export type MarketQuotesStatus = "loading" | "live" | "error";

export type MarketQuotesSnapshot = {
  quotes: Record<string, MarketQuote>;
  status: MarketQuotesStatus;
  lastUpdated: number | null;
};

// Modest cadence: comfortably inside free-provider limits because every poll is
// served from the shared server-side 30s cache for most symbols, and anything
// the configured provider can't answer falls back to real keyless data.
const REFRESH_MS = 45_000;
const BACKOFF_BASE_MS = 8_000;
const MAX_BACKOFF_MS = 60_000;
const FETCH_TIMEOUT_MS = 34_000;

type Store = {
  quotes: Record<string, MarketQuote>;
  status: MarketQuotesStatus;
  lastUpdated: number | null;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setTimeout> | null;
  inflight: boolean;
  failCount: number;
};

let store: Store | null = null;

function getStore(): Store {
  if (!store) {
    store = {
      quotes: {},
      status: "loading",
      lastUpdated: null,
      listeners: new Set(),
      timer: null,
      inflight: false,
      failCount: 0,
    };
  }
  return store;
}

function emit(s: Store) {
  for (const listener of s.listeners) listener();
}

function scheduleNext(s: Store) {
  if (s.timer) clearTimeout(s.timer);
  s.timer = null;
  if (s.listeners.size === 0) return;
  const delay =
    s.status === "error" ? Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, s.failCount - 1), MAX_BACKOFF_MS) : REFRESH_MS;
  s.timer = setTimeout(() => {
    s.timer = null;
    void tick();
  }, delay);
}

async function tick() {
  const s = getStore();
  if (s.inflight || s.listeners.size === 0) return;
  s.inflight = true;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch("/api/invest/market/list", {
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new Error(`list ${res.status}`);
    const body = (await res.json().catch(() => null)) as { quotes?: MarketQuote[] } | null;
    const list = body?.quotes;
    if (!Array.isArray(list)) throw new Error("bad payload");
    const next: Record<string, MarketQuote> = {};
    for (const q of list) {
      if (q && typeof q.symbol === "string" && q.symbol) next[q.symbol] = q;
    }
    if (Object.keys(next).length > 0) {
      s.quotes = next;
      s.status = "live";
      s.lastUpdated = Date.now();
      s.failCount = 0;
    }
  } catch {
    s.failCount += 1;
    if (s.failCount <= 1 && s.listeners.size > 0) {
      // First failure: keep whatever quotes we already have and retry with
      // backoff instead of wiping the screen to "unavailable".
      s.status = "error";
    }
  } finally {
    s.inflight = false;
    emit(s);
    scheduleNext(s);
  }
}

function subscribe(cb: () => void): () => void {
  const s = getStore();
  const hadListeners = s.listeners.size > 0;
  s.listeners.add(cb);
  if (!hadListeners) {
    // Fresh start after full unmount: re-sync immediately.
    s.failCount = 0;
    void tick();
  } else if (!s.inflight && s.status === "error") {
    // A recovering screen has re-subscribed — give it a quick retry window.
    void tick();
  }
  return () => {
    s.listeners.delete(cb);
    if (s.listeners.size === 0 && s.timer) {
      clearTimeout(s.timer);
      s.timer = null;
    }
  };
}

/**
 * Shared live market-data hook. Every screen (Markets, Home, Watchlist,
 * Popular investments, public embed) consumes the SAME singleton store backed
 * by one poller, so prices never diverge between screens and we never create
 * overlapping poll timers. Server-provided `initialQuotes` are used only for
 * the very first paint; afterwards the live feed takes over.
 */
export function useMarketQuotes(initialQuotes?: Record<string, MarketQuote>): MarketQuotesSnapshot & {
  refresh: () => void;
} {
  const s = getStore();
  const [state, setState] = useState<MarketQuotesSnapshot>(() => {
    const quotes = Object.keys(s.quotes).length > 0 ? s.quotes : initialQuotes ?? {};
    return { quotes, status: s.status, lastUpdated: s.lastUpdated };
  });
  const initialRef = useRef(initialQuotes);

  useEffect(() => {
    const s0 = getStore();
    setState({
      quotes: Object.keys(s0.quotes).length > 0 ? s0.quotes : initialRef.current ?? {},
      status: s0.status,
      lastUpdated: s0.lastUpdated,
    });
    const update = () => {
      const cur = getStore();
      setState({ quotes: cur.quotes, status: cur.status, lastUpdated: cur.lastUpdated });
    };
    return subscribe(update);
  }, []);

  const refresh = useCallback(() => {
    void tick();
  }, []);

  return { ...state, refresh };
}

export type { MarketQuote };