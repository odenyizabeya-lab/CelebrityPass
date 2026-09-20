/**
 * Alpaca brokerage client (server-side only).
 *
 * Free by default: with no ALPACA_BASE_URL the client uses Alpaca's free PAPER
 * trading API (https://paper-api.alpaca.markets). Paper trading is 100% free,
 * has the real order/execution API, but moves NO real money — so every position
 * surfaced from paper is marked isDemo and the UI must label it PAPER/DEMO.
 *
 * Live trading (https://api.alpaca.markets) requires a real funded brokerage
 * account (KYC + funds). Switching to live is a single env var — nothing else
 * changes — but it must never be enabled until the account is real.
 */

const DEFAULT_PAPER_BASE = "https://paper-api.alpaca.markets";
const DEFAULT_LIVE_BASE = "https://api.alpaca.markets";

function baseUrl(): string {
  if (process.env.ALPACA_BASE_URL) return process.env.ALPACA_BASE_URL.replace(/\/$/, "");
  return process.env.ALPACA_MODE === "live" ? DEFAULT_LIVE_BASE : DEFAULT_PAPER_BASE;
}

export function isPaper(): boolean {
  return baseUrl() === DEFAULT_PAPER_BASE;
}

function credentials(): { key: string; secret: string } {
  const key = process.env.ALPACA_API_KEY ?? "";
  const secret = process.env.ALPACA_API_SECRET ?? "";
  if (!key || !secret) throw new Error("Alpaca credentials are not configured (ALPACA_API_KEY / ALPACA_API_SECRET).");
  return { key, secret };
}

export function alpacaConfigured(): boolean {
  return Boolean(process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET);
}

async function alpacaFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { key, secret } = credentials();
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "APCA-API-KEY-ID": key,
      "APCA-API-SECRET-KEY": secret,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Alpaca ${path} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export type AlpacaAccount = {
  account_number: string;
  status: string;
  currency: string;
  buying_power: string;
  cash: string;
  equity: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
};

export async function getAlpacaAccount(): Promise<AlpacaAccount> {
  return alpacaFetch<AlpacaAccount>("/v2/account");
}

export type AlpacaOrder = {
  id: string;
  symbol: string;
  side: string; // buy | sell
  type: string; // market | limit | stop
  qty: string;
  status: string;
  filled_qty: string;
  filled_avg_price: string | null;
  fees: string | null;
  submitted_at: string | null;
  filled_at: string | null;
  rejected_at: string | null;
  cancel_requested_at: string | null;
  hwm: string | null;
  last_executed_price: string | null;
};

export type AlpacaPosition = {
  asset_id: string;
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  side: string;
  unrealized_pl: string;
};

function num(s: string | null | undefined): number | null {
  if (s === null || s === undefined || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Place a fractional-share-friendly market order. */
export async function placeAlpacaMarketOrder(input: {
  symbol: string;
  qty: number;
  side: "BUY" | "SELL";
}): Promise<AlpacaOrder> {
  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    throw new Error("Order quantity must be positive.");
  }
  const qty = input.qty.toFixed(4);
  const order = await alpacaFetch<AlpacaOrder>("/v2/orders", {
    method: "POST",
    body: JSON.stringify({
      symbol: input.symbol.toUpperCase(),
      qty,
      side: input.side.toLowerCase(),
      type: "market",
      time_in_force: "day",
    }),
  });
  return order;
}

export async function getAlpacaOrder(orderId: string): Promise<AlpacaOrder> {
  return alpacaFetch<AlpacaOrder>(`/v2/orders/${orderId}`);
}

export async function getAlpacaOrders(limit = 50): Promise<AlpacaOrder[]> {
  return alpacaFetch<AlpacaOrder[]>(`/v2/orders?status=all&limit=${limit}&sort=desc`);
}

export async function getAlpacaPositions(): Promise<AlpacaPosition[]> {
  return alpacaFetch<AlpacaPosition[]>("/v2/positions");
}

/** Real-time quote fallback so orders can be priced even without a market-data key. */
export async function getAlpacaLastQuote(symbol: string): Promise<{ price: number; source: "live" | "unavailable" }> {
  try {
    const data = (await alpacaFetch<Record<string, unknown>>(`/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest`)) as {
      quote?: { ap: string | null; bp: string | null; as: string | null; bs: string | null };
      last?: { trade?: { p: string } };
    };
    const bid = num(data.quote?.bp);
    const ask = num(data.quote?.ap);
    const last = num(data.last?.trade?.p);
    const price = last ?? (bid !== null && ask !== null ? (bid + ask) / 2 : bid ?? ask);
    if (price === null) return { price: 0, source: "unavailable" };
    return { price, source: "live" };
  } catch {
    return { price: 0, source: "unavailable" };
  }
}

/** Map an Alpaca status string onto our MarketOrder status vocabulary. */
export function mapAlpacaOrderStatus(order: AlpacaOrder): string {
  switch (order.status) {
    case "filled":
      return "FILLED";
    case "partially_filled":
      return "PARTIALLY_FILLED";
    case "canceled":
    case "expired":
    case "replaced":
    case "stopped":
    case "done_for_day":
      return Number(order.filled_qty) > 0 ? "PARTIALLY_FILLED" : "CANCELLED";
    case "rejected":
    case "suspended":
      return "REJECTED";
    case "new":
    case "accepted":
    case "accepted_for_bidding":
    case "pending_new":
    case "pending_replace":
    case "pending_cancel":
      return "SUBMITTED";
    default:
      return "SUBMITTED";
  }
}

export type AlpacaFillInfo = {
  quantity: number; // filled quantity (shares, fractional ok)
  price: number | null; // average fill price
  fees: number;
};

export function parseFill(order: AlpacaOrder): AlpacaFillInfo | null {
  const qty = num(order.filled_qty);
  if (qty === null || qty <= 0) return null;
  return {
    quantity: qty,
    price: num(order.filled_avg_price) ?? num(order.last_executed_price),
    fees: num(order.fees) ?? 0,
  };
}