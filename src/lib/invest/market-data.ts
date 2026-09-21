import { prisma } from "@/lib/db";
import { safeAsync } from "@/lib/safe-data";

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

/** Which trading phase the quote comes from, mirroring Yahoo's marketState. */
export type MarketPhase = "PRE" | "REGULAR" | "POST" | "CLOSED";

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
  /** True when the exchange session is currently open (from the API). */
  isMarketOpen: boolean | null;
  /** The exchange-session timestamp reported by the API (or null). */
  marketTime: string | null;
  /** Trading phase of this quote: pre-market / regular / after-hours / closed. */
  marketPhase: MarketPhase | null;
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

// US-listed securities are shown in the exchange's market-session time so
// intraday ranges (1D, 1W) line up with actual trading hours.
const HISTORY_TZ = "America/New_York";

/* ------------------------------------------------------------------------ */
/* CoinGecko — crypto market data, free forever (no API key, no account,     */
/* no card). Used ONLY for CompanyType "CRYPTO" symbols so a real crypto     */
/* price is never routed through the TwelveData free tier or an invented     */
/* number. If CoinGecko is unreachable this yields "unavailable", never a    */
/* fake price.                                                               */
/* ------------------------------------------------------------------------ */

/** Catalog CRYPTO symbol → CoinGecko internal coin id (public, no auth). */
const COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  // On CoinGecko the XRP Ledger asset is indexed under the "ripple" id; the
  // naive "xrp" id returns an empty object from /simple/price and a 404 from
  // /coins/:id, so we must use the real id for XRP quotes & history.
  XRP: "ripple",
  BNB: "binancecoin",
  TRUMP: "official-trump",
};

/** Catalog CRYPTO symbol → Gate.io spot pair (public OHLC, no API key). */
const GATEIO_PAIR: Record<string, string> = {
  BTC: "BTC_USDT",
  ETH: "ETH_USDT",
  SOL: "SOL_USDT",
  XRP: "XRP_USDT",
  BNB: "BNB_USDT",
  TRUMP: "TRUMP_USDT",
};

function gateIoPair(symbol: string): string | null {
  const pair = GATEIO_PAIR[symbol.toUpperCase()];
  return pair ?? null;
}

function coinGeckoId(symbol: string): string | null {
  const id = COINGECKO_ID[symbol.toUpperCase()];
  return id ?? null;
}

function isCryptoSymbol(symbol: string): boolean {
  return coinGeckoId(symbol) !== null;
}

/** CoinGecko "days" per history range (market_chart param). Free endpoint. */
function coinGeckoDays(range: HistoryRange): string {
  switch (range) {
    case "1D":
      return "1";
    case "1W":
      return "7";
    case "1M":
      return "30";
    case "3M":
      return "90";
    case "1Y":
      return "365";
    case "5Y":
      return "1825";
    case "ALL":
      return "max";
  }
}

/**
 * Live crypto quote from CoinGecko's public /simple/price endpoint (free, no
 * API key, no card). Crypto trades 24/7, so isMarketOpen is reported true and
 * marketTime is the moment the quote was fetched. Returns source
 * "unavailable" only when CoinGecko genuinely cannot answer — never invents a
 * coin price.
 */
async function fetchLiveCoinGeckoQuote(symbol: string): Promise<MarketQuote> {
  const id = coinGeckoId(symbol);
  if (!id) return unavailableQuote(symbol);
  const url =
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}` +
    `&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true` +
    `&include_24hr_high_low=true&include_market_cap=true`;
  const data = await requestLiveJson(url, 8_000);
  if (!data) return unavailableQuote(symbol);
  const row = data[id] as Record<string, unknown> | undefined;
  if (!row || typeof row !== "object") return unavailableQuote(symbol);
  const price = num(row.usd);
  if (price === null) return unavailableQuote(symbol);
  const changePct = num(row.usd_24h_change);
  const now = new Date().toISOString();
  return {
    symbol: symbol.toUpperCase(),
    name: null,
    exchange: "CoinGecko",
    currency: "USD",
    price,
    change: changePct !== null ? price * (changePct / 100) : null,
    changePct,
    dayHigh: num(row.usd_24h_high),
    dayLow: num(row.usd_24h_low),
    w52High: num(row.usd_24h_high),
    w52Low: num(row.usd_24h_low),
    volume: num(row.usd_24h_vol),
    marketCap: num(row.usd_market_cap),
    peRatio: null,
    provider: "coingecko",
    source: "live",
    fetchedAt: now,
    isMarketOpen: true,
    marketTime: now,
    marketPhase: "REGULAR",
  };
}

/** Gate.io spot candle interval + limit per history range (public OHLC). */
function gateIoRange(range: HistoryRange): { interval: string; limit: number } {
  switch (range) {
    case "1D":
      return { interval: "30m", limit: 48 };
    case "1W":
      return { interval: "4h", limit: 42 };
    case "1M":
      return { interval: "1d", limit: 31 };
    case "3M":
      return { interval: "1d", limit: 90 };
    case "1Y":
      return { interval: "1d", limit: 365 };
    case "5Y":
      return { interval: "7d", limit: 270 };
    case "ALL":
      return { interval: "7d", limit: 1000 };
  }
}

/**
 * Crypto historical series for charting (1D–1Y) from CoinGecko's public
 * /coins/:id/market_chart. 5Y/ALL are served by Gate.io spot OHLC candles —
 * CoinGecko's free tier only publishes up to 365 days, while Gate.io (also
 * free, real data) publishes decades of weekly candles. If CoinGecko is
 * rate-limited or down for a short range, Gate.io covers every range with a
 * sensible candle granularity. Missing/failed data yields an empty history
 * ("unavailable"), never synthetic points.
 */
async function fetchLiveCoinGeckoHistory(symbol: string, range: HistoryRange): Promise<QuoteHistory> {
  const id = coinGeckoId(symbol);
  if (id && (range === "1D" || range === "1W" || range === "1M" || range === "3M" || range === "1Y")) {
    const days = coinGeckoDays(range);
    // days=1 without an interval returns intraday points; longer ranges pin
    // daily candles so 365 days of history stays a sane (~366) series.
    const interval = days === "1" ? "" : "&interval=daily";
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}${interval}`;
    const data = await requestLiveJson(url, 8_000);
    const pricesRaw = data?.prices;
    const prices = Array.isArray(pricesRaw) ? (pricesRaw as unknown[]) : [];
    const points: HistoryPoint[] = [];
    for (const entry of prices) {
      const pair = Array.isArray(entry) && entry.length >= 2 ? entry : null;
      if (!pair) continue;
      const ms = Number(pair[0]);
      const price = num(pair[1]);
      if (!Number.isFinite(ms) || price === null) continue;
      points.push({ time: new Date(ms).toISOString(), price: Math.round(price * 100) / 100 });
    }
    if (points.length > 0) {
      return {
        symbol: symbol.toUpperCase(),
        range,
        provider: "coingecko",
        source: "live",
        points,
        fetchedAt: new Date().toISOString(),
      };
    }
    // CoinGecko answered nothing useful (or was rate-limited) — fall through to
    // Gate.io below so charting still has a real provider for this coin/range.
  }

  const pair = gateIoPair(symbol);
  if (!pair) return emptyHistory(symbol, range);
  const { interval, limit } = gateIoRange(range);
  const url = `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${encodeURIComponent(pair)}&interval=${interval}&limit=${limit}`;
  const data = await requestLiveJson(url, 8_000);
  const values = Array.isArray(data) ? (data as unknown[]) : [];
  const points: HistoryPoint[] = [];
  for (const entry of values) {
    const row = Array.isArray(entry) && entry.length >= 3 ? entry : null;
    if (!row) continue;
    const sec = Number(row[0]);
    const close = num(row[2]);
    if (!Number.isFinite(sec) || close === null) continue;
    const d = new Date(sec * 1000);
    if (Number.isNaN(d.getTime())) continue;
    points.push({ time: d.toISOString(), price: Math.round(close * 100) / 100 });
  }
  points.sort((a, b) => a.time.localeCompare(b.time));
  if (points.length === 0) return emptyHistory(symbol, range);
  return {
    symbol: symbol.toUpperCase(),
    range,
    provider: "gate-io",
    source: "live",
    points,
    fetchedAt: new Date().toISOString(),
  };
}

const memory = new Map<string, { t: number; data: { point: MarketQuote } }>();
const historyMemory = new Map<string, { t: number; data: { history: QuoteHistory } }>();

/** In-flight quote fetches keyed by symbol — deduplicates concurrent callers. */
const inflightQuotes = new Map<string, Promise<MarketQuote>>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch a Twelve Data JSON response with a couple of quick retries for the
 * free-tier 429 / transient 5xx and network errors. Returns null when the
 * upstream could not be reached after retries.
 */
async function requestLiveJson(url: string, timeoutMs: number): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      // 429 = free-plan credits exhausted, 5xx = upstream hiccup. Both are
      // transient, so retry once; never surface them as real chart data.
      if ((res.status === 429 || res.status >= 500) && attempt < 1) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      if (!res.ok) return null;
      const raw = await res.text();
      if (!raw) return null;
      const data = JSON.parse(raw) as Record<string, unknown>;
      // Twelve Data also reports rate-limit / auth issues as HTTP 200 with
      // status:"error". Retry those once too.
      if (data.status === "error" && attempt < 1) {
        await sleep(300 * (attempt + 1));
        continue;
      }
      return data;
    } catch {
      if (attempt < 1) {
        await sleep(300);
        continue;
      }
    }
  }
  return null;
}

function liveKey(): string {
  return process.env.MARKET_DATA_API_KEY ?? "";
}

function mockEnabled(): boolean {
  if (process.env.MARKET_DATA_MODE === "live") return false;
  // Explicit dev/mock mode, or any non-production environment without a key.
  return (
    process.env.MARKET_DATA_MODE === "mock" ||
    (process.env.NODE_ENV !== "production" && !liveKey())
  );
}

export function unavailableQuote(symbol: string): MarketQuote {
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
    isMarketOpen: null,
    marketTime: null,
    marketPhase: null,
  };
}

export function emptyHistory(symbol: string, range: HistoryRange): QuoteHistory {
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
    isMarketOpen: true,
    marketTime: new Date().toISOString(),
    marketPhase: null,
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

  // Deduplicate concurrent fetches for the same symbol: many screens can ask
  // for the same quote in the same tick and must trigger exactly one upstream
  // request (prevents wasteful bursts and rate-limit pressure).
  const pending = inflightQuotes.get(key);
  if (pending) return pending;

  const task = (async () => {
    try {
      let quote: MarketQuote;
      if (isCryptoSymbol(key)) {
        // Crypto has a genuinely free provider (CoinGecko, no key/card). It
        // never falls through to the TwelveData/Yahoo path (which cannot
        // answer crypto) and never to the demo branch. If CoinGecko itself
        // fails, the source is honestly "unavailable" — never an invented price.
        quote = await fetchLiveCoinGeckoQuote(key);
      } else if (mockEnabled()) {
        quote = demoQuote(key);
      } else {
        // Configured provider (TwelveData) first; if it is rate-limited or
        // down, fall back to Yahoo Finance (also real data, no key) so a valid
        // quote is never replaced by "unavailable".
        quote = await fetchLiveQuote(key);
      }

      // Only cache results that actually contain data. Unavailable/empty
      // results are never cached, so a transient upstream failure cannot
      // poison the cache and every failed fetch gets immediately retried.
      if (quote.source !== "unavailable") {
        memory.set(`q:${key}`, { t: Date.now(), data: { point: quote } });
        persistQuoteCache(quote).catch(() => {});
      }
      return quote;
    } finally {
      inflightQuotes.delete(key);
    }
  })();
  inflightQuotes.set(key, task);
  return task;
}

/**
 * Fetch the freshest possible quote for real-time polling. Deliberately skips
 * the 30s quote cache so repeated polls reach the live provider — and honours
 * the same honesty rules as getQuote: only "live" results are ever surfaced,
 * never invented numbers.
 */
export async function getLiveTick(symbol: string): Promise<MarketQuote> {
  const key = symbol.toUpperCase();
  if (isCryptoSymbol(key)) {
    const quote = await fetchLiveCoinGeckoQuote(key);
    if (quote.source === "live") {
      memory.set(`q:${key}`, { t: Date.now(), data: { point: quote } });
      persistQuoteCache(quote).catch(() => {});
    }
    return quote;
  }
  if (mockEnabled()) {
    const quote = demoQuote(key);
    persistQuoteCache(quote).catch(() => {});
    return quote;
  }
  if (!liveKey()) return unavailableQuote(key);
  const quote = await fetchLiveQuote(key);
  if (quote.source === "live") {
    // Refresh the short cache only; persist a snapshot for the admin status.
    memory.set(`q:${key}`, { t: Date.now(), data: { point: quote } });
    persistQuoteCache(quote).catch(() => {});
  }
  return quote;
}

/** Historical series for charting. Same honesty rules as getQuote. */
export async function getHistory(symbol: string, range: HistoryRange): Promise<QuoteHistory> {
  const key = symbol.toUpperCase();
  const ck = `h:${key}:${range}`;
  const cached = historyMemory.get(ck);
  if (cached && Date.now() - cached.t < HISTORY_TTL_MS) return cached.data.history;

  let history: QuoteHistory;
  if (isCryptoSymbol(key)) {
    history = await fetchLiveCoinGeckoHistory(key, range);
  } else if (mockEnabled()) {
    history = {
      symbol: key,
      range,
      provider: "mock",
      source: "dev-mock",
      points: demoHistory(key, range),
      fetchedAt: new Date().toISOString(),
    };
  } else if (liveKey()) {
    history = await fetchLiveHistory(key, range);
  } else {
    history = emptyHistory(key, range);
  }

  if (history.points.length > 0) {
    historyMemory.set(ck, { t: Date.now(), data: { history } });
  }
  return history;
}

/**
 * Batch-loader for many symbols with per-symbol isolation: a single failing
 * symbol (or a slow upstream) can only affect its own row, never the whole
 * page. Fetches are processed with limited concurrency so a 20-security list
 * layers requests instead of bursting free providers all at once.
 */
export async function getQuotes(symbols: string[], concurrency = 6): Promise<MarketQuote[]> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const out = new Array<MarketQuote>(unique.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < unique.length) {
      const idx = cursor++;
      const sym = unique[idx];
      out[idx] = await safeAsync(() => getQuote(sym), unavailableQuote(sym));
    }
  };
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, unique.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return out;
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
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey ?? "")}&timezone=${HISTORY_TZ}`;
    const data = await requestLiveJson(url, 6_000);
    if (!data || data.status === "error") {
      // TwelveData is rate-limited or unhealthy — fall back to Yahoo Finance
      // (real market data, no key) rather than declaring valid symbols
      // "unavailable".
      return fetchYahooQuote(symbol);
    }
    const price = num(data.close);
    if (price === null) return fetchYahooQuote(symbol);
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
      isMarketOpen: typeof data.is_market_open === "boolean" ? data.is_market_open : null,
      marketTime: typeof data.datetime === "string" && data.datetime ? data.datetime : null,
      marketPhase:
        typeof data.is_market_open === "boolean"
          ? data.is_market_open
            ? ("REGULAR" as const)
            : ("CLOSED" as const)
          : null,
    };
  } catch {
    return fetchYahooQuote(symbol);
  }
}

/**
 * Free, keyless Yahoo Finance quote (v8 chart meta is populated for equities,
 * ETFs, commodities trusts and indices around the clock). Serves as the
 * resilience fallback when the configured provider is down or rate-limited —
 * always real market data, never an invented number. Price reflects the
 * CURRENT trading phase (pre-market / regular / after-hours) exactly like the
 * public sites do, so out-of-hours numbers still move.
 */
async function fetchYahooQuote(symbol: string): Promise<MarketQuote> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const data = await requestLiveJson(url, 6_000);
    const chart = (data?.chart ?? {}) as { result?: Record<string, unknown>[] };
    const result = Array.isArray(chart.result) ? chart.result[0] : undefined;
    const meta = (result?.meta ?? {}) as Record<string, unknown>;
    const marketState = typeof meta.marketState === "string" ? meta.marketState : "";
    const phase: MarketPhase | null = yahooPhase(marketState);

    // Like Google: during pre-market/after-hours show THAT session's price,
    // not the stale regular-session close. Fall back to the regular price if
    // the out-of-hours session hasn't printed yet.
    const price =
      num(meta.preMarketPrice) ??
      num(meta.postMarketPrice) ??
      num(meta.regularMarketPrice);
    if (price === null) return unavailableQuote(symbol);

    const change =
      num(meta.preMarketChange) ?? num(meta.postMarketChange) ?? num(meta.regularMarketChange);
    const changePct =
      num(meta.preMarketChangePercent) ??
      num(meta.postMarketChangePercent) ??
      num(meta.regularMarketChangePercent);
    const prev = num(meta.previousClose) ?? num(meta.chartPreviousClose);
    const timeEpoch =
      num(meta.preMarketTime) ?? num(meta.postMarketTime) ?? num(meta.regularMarketTime);
    return {
      symbol: String(meta.symbol ?? symbol).toUpperCase(),
      name: typeof meta.longName === "string" ? meta.longName : typeof meta.shortName === "string" ? meta.shortName : null,
      exchange: typeof meta.fullExchangeName === "string" ? meta.fullExchangeName : typeof meta.exchangeName === "string" ? meta.exchangeName : null,
      currency: (meta.currency as string) ?? "USD",
      price,
      change: change ?? (prev !== null ? price - prev : null),
      changePct: changePct ?? (prev !== null && prev !== 0 ? ((price - prev) / prev) * 100 : null),
      dayHigh: num(meta.regularMarketDayHigh),
      dayLow: num(meta.regularMarketDayLow),
      w52High: num(meta.fiftyTwoWeekHigh),
      w52Low: num(meta.fiftyTwoWeekLow),
      volume: num(meta.regularMarketVolume),
      marketCap: num(meta.marketCap),
      peRatio: num(meta.trailingPE),
      provider: "yahoo-finance",
      source: "live",
      fetchedAt: new Date().toISOString(),
      isMarketOpen: phase === "REGULAR",
      marketTime: timeEpoch !== null ? new Date(timeEpoch * 1000).toISOString() : null,
      marketPhase: phase,
    };
  } catch {
    return unavailableQuote(symbol);
  }
}

/** Map Yahoo marketState to our phase; default CLOSED (no session data). */
function yahooPhase(marketState: string): MarketPhase {
  if (marketState === "REGULAR") return "REGULAR";
  if (marketState === "PRE" || marketState === "PREPRE") return "PRE";
  if (marketState === "POST" || marketState === "POSTPOST") return "POST";
  return "CLOSED";
}

/** Map the chart ranges to Yahoo chart range/interval parameters (real data). */
function yahooRange(range: HistoryRange): { range: string; interval: string } {
  switch (range) {
    case "1D":
      return { range: "1d", interval: "5m" };
    case "1W":
      return { range: "5d", interval: "30m" };
    case "1M":
      return { range: "1mo", interval: "1d" };
    case "3M":
      return { range: "3mo", interval: "1d" };
    case "1Y":
      return { range: "1y", interval: "1d" };
    case "5Y":
      return { range: "5y", interval: "1d" };
    case "ALL":
      return { range: "max", interval: "1wk" };
  }
}

/** Historical series from Yahoo Finance (free, keyless). */
async function fetchYahooHistory(symbol: string, range: HistoryRange): Promise<QuoteHistory> {
  try {
    const { range: yRange, interval } = yahooRange(range);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${yRange}&interval=${interval}`;
    const data = await requestLiveJson(url, 8_000);
    const chart = (data?.chart ?? {}) as { result?: Record<string, unknown>[] };
    const result = Array.isArray(chart.result) ? chart.result[0] : undefined;
    const ts = Array.isArray(result?.timestamp) ? (result.timestamp as number[]) : [];
    const quote = (result?.indicators as { quote?: Record<string, unknown>[] } | undefined)?.quote?.[0] ?? {};
    const closes = Array.isArray(quote.close) ? (quote.close as (number | null)[]) : [];
    if (ts.length === 0 || closes.length === 0) return emptyHistory(symbol, range);

    const points: HistoryPoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const close = num(closes[i]);
      const sec = ts[i];
      if (close === null || !Number.isFinite(sec)) continue;
      const d = new Date(sec * 1000);
      if (Number.isNaN(d.getTime())) continue;
      const t = interval === "5m" || interval === "30m" ? d.toISOString() : d.toISOString().slice(0, 10);
      points.push({ time: t, price: Math.round(close * 100) / 100 });
    }
    points.sort((a, b) => a.time.localeCompare(b.time));
    if (points.length === 0) return emptyHistory(symbol, range);
    return {
      symbol,
      range,
      provider: "yahoo-finance",
      source: "live",
      points,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return emptyHistory(symbol, range);
  }
}

async function fetchLiveHistory(symbol: string, range: HistoryRange): Promise<QuoteHistory> {
  const apiKey = process.env.MARKET_DATA_API_KEY;

  const cfg: { interval: string; outputsize: number } = (() => {
    switch (range) {
      case "1D":
        // A full US session is 390 one-minute bars; ask for the whole day so
        // the intraday chart is not truncated to the last couple of hours.
        return { interval: "1min", outputsize: 390 };
      case "1W":
        return { interval: "30min", outputsize: 130 };
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
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${cfg.interval}&outputsize=${cfg.outputsize}&apikey=${encodeURIComponent(apiKey ?? "")}&timezone=${HISTORY_TZ}`;
    const data = await requestLiveJson(url, 8_000);
    if (!data || data.status === "error") {
      // Rate-limited or unhealthy — fall back to Yahoo's real chart data so
      // the range still renders instead of an empty "unavailable" chart.
      return fetchYahooHistory(symbol, range);
    }
    const values = Array.isArray(data.values) ? (data.values as Record<string, unknown>[]) : [];
    if (values.length === 0) return fetchYahooHistory(symbol, range);
    const points = values
      .map((v) => {
        const close = num(v.close);
        if (close === null) return null;
        const raw = String(v.datetime ?? "");
        // Intraday timestamps arrive as "2026-09-18 15:59:00"; normalize to
        // ISO-style "2026-09-18T15:59:00" so chart label/range logic (which
        // keys on "T") renders consistent market-session times.
        const time = raw.includes(" ") ? raw.replace(" ", "T") : raw;
        return time ? { time, price: close } : null;
      })
      .filter((p): p is HistoryPoint => p !== null)
      .filter((p) => p.time.length > 0 && Number.isFinite(p.price))
      .sort((a, b) => a.time.localeCompare(b.time));
    if (points.length === 0) return fetchYahooHistory(symbol, range);
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