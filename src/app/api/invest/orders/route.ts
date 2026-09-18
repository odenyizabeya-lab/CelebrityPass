import { NextResponse } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { createMarketOrder, syncBrokerAccount } from "@/lib/invest/brokerage";
import { getQuote } from "@/lib/invest/market-data";
import { getCompany } from "@/lib/invest/companies";
import { getAlpacaLastQuote } from "@/lib/invest/alpaca";
import { makeRateLimiter } from "@/lib/secure";

export const dynamic = "force-dynamic";

const MIN_AMOUNT_USD = Number(process.env.INVEST_MIN_AMOUNT_USD ?? 100);
const MAX_AMOUNT_USD = 250_000;
const orderLimiter = makeRateLimiter(10, 60_000);

/**
 * POST /api/invest/orders — place a market order.
 *
 * The amount is validated server-side and never trusted from the client. The
 * quantity is always REcalculated from the current provider quote. Without a
 * brokerage integration, the order is recorded as REJECTED with an honest
 * reason — never validated as a fake execution.
 */
export async function POST(request: Request) {
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const allowed = orderLimiter(`order:${fanId}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many order attempts. Try again shortly." }, { status: 429 });
  }

  let body: { symbol?: string; amountCents?: number; orderType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const symbol = String(body.symbol ?? "").toUpperCase();
  const amountCents = Math.floor(Number(body.amountCents));
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
  }
  const amountUsd = amountCents / 100;
  if (amountUsd < MIN_AMOUNT_USD) {
    return NextResponse.json({ error: `Minimum investment is $${MIN_AMOUNT_USD.toFixed(2)}.` }, { status: 400 });
  }
  if (amountUsd > MAX_AMOUNT_USD) {
    return NextResponse.json({ error: `Maximum investment is $${MAX_AMOUNT_USD.toFixed(2)}.` }, { status: 400 });
  }

  const company = getCompany(symbol);
  if (!company) {
    return NextResponse.json({ error: "Unknown symbol." }, { status: 400 });
  }

  // Sync the brokerage account so buying power reflects the real provider.
  await syncBrokerAccount(fanId).catch(() => {});

  // Price from the live market-data provider when available; otherwise fall
  // back to the brokerage's own quote so a real order can still be priced.
  let quote = await getQuote(company.symbol);
  if (quote.source === "unavailable" || quote.price === null) {
    const brokerQuote = await getAlpacaLastQuote(company.symbol);
    if (brokerQuote.source === "live" && brokerQuote.price > 0) {
      quote = {
        ...quote,
        price: brokerQuote.price,
        change: null,
        changePct: null,
        provider: "alpaca",
        source: "live",
      };
    }
  }
  if (quote.source === "unavailable" || quote.price === null) {
    return NextResponse.json({ error: "Unable to load live market data. No order can be placed right now." }, { status: 503 });
  }

  // Server-side quantity estimate from the REAL provider price.
  const quantity = amountUsd / quote.price;

  const result = await createMarketOrder({
    fanId,
    symbol: company.symbol,
    side: "BUY",
    orderType: "MARKET",
    quantity,
  });

  if (!result.ok) {
    return NextResponse.json({ status: result.status, error: result.error, orderId: result.orderId }, { status: 503 });
  }

  return NextResponse.json({ status: result.status, orderId: result.orderId });
}