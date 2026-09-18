import { prisma } from "@/lib/db";

/**
 * MarketDataService — the single door for all market data.
 *
 * Never returns invented numbers as if they were live:
 *  - Live provider configured  -> real quotes/history (source: "live").
 *  - Dev/MOCK mode (explicit)  -> plausible demo numbers, source "dev-mock",
 *    and the UI MUST render the "DEV DATA · NOT LIVE" tag from this source.
 *  - Nothing available         -> source "unavailable", nulls; the UI must
 *    render "Market data unavailable" instead of inventing values.
 */

export type QuoteSource = "live" | "dev-mock" | "unavailable";

export type MarketQuote = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  currency: string;
  price: number | null;
  change: number | null;
  changePct: number | null; // e.g. 1.86
  dayHigh: number | null;
  dayLow: number | null;
  w52High: number | null;
  w52Low: number | null;
  volume: number | null;
  marketCap: number | null;
  peRatio: number | null;
  provider: string;
  source: QuoteSource;
  fetchedAt: string | null;
};

export type HistoryRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y" | "ALL";

export type HistoryPoint = { time: string; price: number };

export type QuoteHistory = {
  symbol: string;
  range: HistoryRange;
  provider: string;
  source: QuoteSource;
  points: HistoryPoint[];
  fetchedAt: string;
};

const QUOTE_TTL_MS = 30_000;
const HISTORY_TTL_MS = 5 * 60_000;

const memory = new Map<string, { t: number; data: { point: MarketQuote } }>();
const historyMemory = new Map<string, { t: number; data: { history: QuoteHistory } }>();

function liveKey(symbol: string): string {
  return process.env.MARKET_DATA_API_KEY ?? "";
}

function mockEnabled(): boolean {
  if (process.env.MARKET_DATA_MODE === "live") return false;
  // Explicit dev/mock mode, or any non-production environment without a key.
  return (
    process.env.MARKET_DATA_MODE === "mock" ||
    (process.env.NODE_ENV !== "production" && !liveKey(symbolSentinel()))
  );
}

// Kept simple: mock mode is decided per process, not per symbol.
function symbolSentinel(): string {
  return "TSLA";
}

function unavailableQuote(symbol: string): MarketQuote {
  return {
    symbol,
    name: null,
    exchange: null,
    currency: "USD",
    price: null,
    change: null,
    changePct: null,
    dayHigh: null,
    dayLow: null,
    w52High: null,
    w52Low: null,
    volume: null,
    marketCap: null,
    peRatio: null,
    provider: "none",
    source: "unavailable",
    fetchedAt: null,
  };
}

function emptyHistory(symbol: string, range: HistoryRange): QuoteHistory {
  return {
    symbol,
    range,
    provider: "none",
    source: "unavailable",
    points: [],
    fetchedAt: new Date(0).toISOString(),
  };
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Deterministic, trended demo series for a symbol — NEVER shown in prod. */
function demoQuote(symbol: string): MarketQuote {
  const base = demoBasePrice(symbol);
  const drift = ((symbol.length * 7919) % 97 - 48) / 100;
  const price = Math.max(1, base + drift);
  const changePct = (((symbol.charCodeAt(1) || 7) % 7) - 3) * 0.4;
  const change = price * (changePct / 100);
  return {
    symbol,
    name: demoName(symbol),
    exchange: "NASDAQ",
    currency: "USD",
    price,
    change,
    changePct,
    dayHigh: price * (1 + 0.018),
    dayLow: price * (1 - 0.012),
    w52High: base * 1.35,
    w52Low: base * 0.72,
    volume: Math.round((symbol.length * 1_000_000 + Math.abs(Math.sin(symbol.length) * 9_000_000)) * symbol.length * 100) % 120_000_000,
    marketCap: Math.round(base * 100 * (250_000 + symbol.length * 41_000)) / 100,
    peRatio: 20 + ((symbol.length * 13) % 60),
    provider: "mock",
    source: "dev-mock",
    fetchedAt: new Date().toISOString(),
  };
}

function demoBasePrice(symbol: string): number {
  const seed = symbol.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return Math.max(5, (seed % 48000) / 100 + 40);
}

function demoName(symbol: string): string {
  return symbol === "TSLA" ? "Tesla, Inc." : `${symbol} Corp`;
}

function demoHistory(symbol: string, range: HistoryRange): HistoryPoint[] {
  const base = demoBasePrice(symbol);
  const points: HistoryPoint[] = [];
  let n = 20;
  if (range === "1D") n = 60;
  else if (range === "1W") n = 7;
  else if (range === "1M") n = 22;
  else if (range === "3M") n = 66;
  else if (range === "1Y") n = 252;
  else if (range === "5Y") n = 260;
  else n = 500;

  const now = Date.now();
  let value = base * 0.94;
  let ts = now - n * 86_400_000;
  for (let i = 0; i < n; i++) {
    value = Math.max(1, value * (1 + (Math.sin(i * 1.7 + symbol.length) * 0.012 + ((symbol.charCodeAt(0) + i * 7) % 9 - 4) * 0.001)));
    ts += 86_400_000;
    const d = new Date(ts);
    points.push({ time: d.toISOString().slice(0, 10), price: Math.round(value * 100) / 100 });
  }
  return points;
}

/**
 * Fetch a (possibly cached) quote for a symbol. In production without a live
 * provider key this returns source "unavailable" — never a fake price.
 */
export async function getQuote(symbol: string): Promise<MarketQuote> {
  const key = symbol.toUpperCase();
  const cached = memory.get(`q:${key}`);
  if (cached && Date.now() - cached.t < QUOTE_TTL_MS) return cached.data.point;

  let quote: MarketQuote;
  if (mockEnabled()) {
    quote = demoQuote(key);
    persistQuoteCache(quote).catch(() => {});
  } else if (liveKey(key)) {
    quote = await fetchLiveQuote(key);
    persistQuoteCache(quote).catch(() => {});
  } else {
    quote = unavailableQuote(key);
  }

  memory.set(`q:${key}`, { t: Date.now(), data: { point: quote } });
  return quote;
}

/** Historical series for charting. Same honesty rules as getQuote. */
export async function getHistory(symbol: string, range: HistoryRange): Promise<QuoteHistory> {
  const key = symbol.toUpperCase();
  const ck = `h:${key}:${range}`;
  const cached = historyMemory.get(ck);
  if (cached && Date.now() - cached.t < HISTORY_TTL_MS) return cached.data.history;

  let history: QuoteHistory;
  if (mockEnabled()) {
    history = {
      symbol: key,
      range,
      provider: "mock",
      source: "dev-mock",
      points: demoHistory(key, range),
      fetchedAt: new Date().toISOString(),
    };
  } else if (liveKey(key)) {
    history = await fetchLiveHistory(key, range);
  } else {
    history = emptyHistory(key, range);
  }

  historyMemory.set(ck, { t: Date.now(), data: { history } });
  return history;
}

/** Persist the latest quote snapshot to the DB cache (admin market-data status). */
async function persistQuoteCache(q: MarketQuote): Promise<void> {
  if (q.source === "unavailable" || q.price === null) return;
  await prisma.marketQuoteCache.upsert({
    where: { symbol: q.symbol },
    update: {
      name: q.name,
      exchange: q.exchange,
      currency: q.currency,
      priceCents: Math.round(q.price * 100),
      changeCents: q.change !== null ? Math.round(q.change * 100) : null,
      changePercent: q.changePct !== null ? Math.round(q.changePct * 100) : null,
      dayHighCents: q.dayHigh !== null ? Math.round(q.dayHigh * 100) : null,
      dayLowCents: q.dayLow !== null ? Math.round(q.dayLow * 100) : null,
      fiftyTwoWeekHighCents: q.w52High !== null ? Math.round(q.w52High * 100) : null,
      fiftyTwoWeekLowCents: q.w52Low !== null ? Math.round(q.w52Low * 100) : null,
      volume: q.volume !== null ? BigInt(q.volume) : null,
      marketCapCents: q.marketCap !== null ? BigInt(Math.round(q.marketCap * 100)) : null,
      peRatio: q.peRatio !== null ? q.peRatio : null,
      provider: q.provider,
      fetchSource: q.source,
      fetchedAt: new Date(),
    },
    create: {
      symbol: q.symbol,
      name: q.name,
      exchange: q.exchange,
      currency: q.currency,
      priceCents: Math.round(q.price * 100),
      changeCents: q.change !== null ? Math.round(q.change * 100) : null,
      changePercent: q.changePct !== null ? Math.round(q.changePct * 100) : null,
      dayHighCents: q.dayHigh !== null ? Math.round(q.dayHigh * 100) : null,
      dayLowCents: q.dayLow !== null ? Math.round(q.dayLow * 100) : null,
      fiftyTwoWeekHighCents: q.w52High !== null ? Math.round(q.w52High * 100) : null,
      fiftyTwoWeekLowCents: q.w52Low !== null ? Math.round(q.w52Low * 100) : null,
      volume: q.volume !== null ? BigInt(q.volume) : null,
      marketCapCents: q.marketCap !== null ? BigInt(Math.round(q.marketCap * 100)) : null,
      peRatio: q.peRatio !== null ? q.peRatio : null,
      provider: q.provider,
      fetchSource: q.source,
      fetchedAt: new Date(),
    },
  });
}

async function fetchLiveQuote(symbol: string): Promise<MarketQuote> {
  const apiKey = process.env.MARKET_DATA_API_KEY;
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey ?? "")}&timezone=UTC`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return unavailableQuote(symbol);
    const data = (await res.json()) as Record<string, unknown>;
    if (data.status === "error" || data.code === 429) return unavailableQuote(symbol);
    const price = num(data.close);
    if (price === null) return unavailableQuote(symbol);
    const w52 = (data.fifty_two_week ?? {}) as Record<string, unknown>;
    return {
      symbol: (data.symbol as string) ?? symbol,
      name: (data.name as string) ?? null,
      exchange: (data.exchange as string) ?? null,
      currency: (data.currency as string) ?? "USD",
      price,
      change: num(data.change),
      changePct: num(data.percent_change),
      dayHigh: num(data.high),
      dayLow: num(data.low),
      w52High: num(w52.high),
      w52Low: num(w52.low),
      volume: num(data.volume),
      marketCap: num(data.market_cap),
      peRatio: num(data.pe_ratio),
      provider: "twelve-data",
      source: "live",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return unavailableQuote(symbol);
  }
}

async function fetchLiveHistory(symbol: string, range: HistoryRange): Promise<QuoteHistory> {
  const apiKey = process.env.MARKET_DATA_API_KEY;

  const cfg: { interval: string; outputsize: number } = (() => {
    switch (range) {
      case "1D":
        return { interval: "1min", outputsize: 80 };
      case "1W":
        return { interval: "30min", outputsize: 80 };
      case "1M":
        return { interval: "1day", outputsize: 31 };
      case "3M":
        return { interval: "1day", outputsize: 63 };
      case "1Y":
        return { interval: "1day", outputsize: 252 };
      case "5Y":
        return { interval: "1month", outputsize: 60 };
      case "ALL":
        return { interval: "1month", outputsize: 240 };
    }
  })();

  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${cfg.interval}&outputsize=${cfg.outputsize}&apikey=${encodeURIComponent(apiKey ?? "")}&timezone=UTC`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return emptyHistory(symbol, range);
    const data = (await res.json()) as Record<string, unknown>;
    const values = Array.isArray(data.values) ? (data.values as Record<string, unknown>[]) : [];
    if (values.length === 0) return emptyHistory(symbol, range);
    const points = values
      .map((v) => {
        const close = num(v.close);
        if (close === null) return null;
        return { time: String(v.datetime ?? ""), price: close };
      })
      .filter((p): p is HistoryPoint => p !== null)
      .sort((a, b) => a.time.localeCompare(b.time));
    return {
      symbol,
      range,
      provider: "twelve-data",
      source: "live",
      points,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return emptyHistory(symbol, range);
  }
}

/** Latest live/mock snapshot persisted in the DB cache (admin market-data status). */
export async function getCachedQuoteRow(symbol: string) {
  return prisma.marketQuoteCache.findUnique({ where: { symbol: symbol.toUpperCase() } });
}