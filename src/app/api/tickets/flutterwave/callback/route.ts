// GET /api/tickets/flutterwave/callback — Flutterwave redirects the customer
// here after reaching the hosted checkout page for a TICKET order. Settlement
// is NEVER driven from this redirect: an order is only confirmed by the webhook
// after a server-side GET /transactions/{id}/verify re-check. This route:
//   1. marks the order FAILED when Flutterwave reports an explicit
//      failed/cancelled/expired outcome in the query string,
//   2. sends a confirmed customer straight to their order page,
//   3. otherwise shows a lightweight "confirming payment" page that polls the
//      order status API until the webhook confirms it (or it fails/times out).
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { pushStatusHistory } from "@/lib/ticketing/helpers";

export const dynamic = "force-dynamic";

const ABANDONED_STATUSES = new Set(["cancelled", "declined", "failed", "expired", "abandoned"]);
const SUCCESS_QUERY_STATUSES = new Set(["successful", "success", "completed"]);

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const orderRef = (searchParams.get("ref") || "").trim();
  const token = (searchParams.get("t") || "").trim();
  if (!orderRef) return NextResponse.redirect(request.nextUrl.origin);

  const order = orderRef
    ? await prisma.ticketOrder.findUnique({ where: { orderRef }, include: { event: { select: { name: true } } } })
    : null;
  if (!order || order.accessToken !== token) {
    return NextResponse.redirect(request.nextUrl.origin);
  }

  const host = request.nextUrl.origin;
  const orderUrl = (extra: string) => NextResponse.redirect(`${host}/order/${order.orderRef}?t=${order.accessToken}${extra}`);

  // Flutterwave reports a user cancelling (or the attempt failing) via ?status=…
  const statusParam = (searchParams.get("status") ?? "").toLowerCase();
  if (ABANDONED_STATUSES.has(statusParam) && order.status === "PAYMENT_PROCESSING") {
    await prisma.ticketOrder.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        paymentStatus: "FAILED",
        statusHistoryJson: pushStatusHistory(order.statusHistoryJson, { status: "FAILED", at: new Date().toISOString(), note: "Card payment cancelled or declined." }),
      },
    });
    await prisma.ticketTransaction
      .create({ data: { orderId: order.id, kind: "PAYMENT", status: "FAILED", amountCents: order.totalCents, currency: order.currency, provider: "flutterwave", message: "Card payment cancelled or declined on the payment page." } })
      .catch(() => undefined);
    return orderUrl(`&status=${statusParam}`);
  }

  if (order.status === "CONFIRMED") return orderUrl("&status=confirmed");
  if (order.status === "FAILED") return orderUrl("&status=failed");
  if (order.status === "CANCELLED" || order.status === "REFUNDED") return orderUrl(`&status=${order.status.toLowerCase()}`);

  void SUCCESS_QUERY_STATUSES; // informational only — the webhook is the source of truth.

  return confirmationPage({ orderRef: order.orderRef, token, eventName: order.event?.name ?? null });
}

function confirmationPage({ orderRef, token, eventName }: { orderRef: string; token: string; eventName: string | null }): Response {
  const pollUrl = `/api/tickets/orders/${encodeURIComponent(orderRef)}?t=${encodeURIComponent(token)}`;
  const orderUrl = `/order/${encodeURIComponent(orderRef)}?t=${encodeURIComponent(token)}`;
  const eventLabel = eventName ? esc(eventName) : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Confirming your payment — CelebrityPass</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #09090b; color: #fafafa; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
  .card { max-width: 430px; width: 100%; background: #111113; border: 1px solid #27272a; border-radius: 20px; padding: 40px 32px; text-align: center; }
  .spinner { width: 52px; height: 52px; margin: 0 auto 24px; border-radius: 50%; border: 4px solid #27272a; border-top-color: #f97316; animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  h1 { font-size: 1.25rem; margin: 0 0 8px; font-weight: 800; }
  p { color: #a1a1aa; font-size: 0.9rem; line-height: 1.6; margin: 6px 0; }
  .name { color: #fafafa; font-weight: 700; }
  .links { margin-top: 24px; display: flex; gap: 10px; justify-content: center; }
  a { color: #f97316; font-size: 0.85rem; font-weight: 700; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .muted { color: #71717a; font-size: 0.78rem; margin-top: 14px; }
</style>
</head>
<body>
  <div class="card">
    <div class="spinner" id="spinner"></div>
    <h1>Confirming your payment</h1>
    <p><span class="name">${eventLabel || "Your tickets"}</span> — we&rsquo;re just confirming your card payment.</p>
    <p>This usually takes a few seconds. Don&rsquo;t close this window.</p>
    <div class="links">
      <a href="${orderUrl}">Back to your order</a>
    </div>
    <p class="muted">If you&rsquo;re not redirected automatically, refresh this page in a moment.</p>
  </div>
<script>
  (function () {
    var URL = ${JSON.stringify(pollUrl)};
    var ORDER = ${JSON.stringify(orderUrl)};
    var tries = 0;
    var MAX_TRIES = 30; // ~75s of polling
    var INTERVAL = 2500;

    function go(url) {
      if (window.stop) window.stop();
      window.location.assign(url);
    }

    async function poll() {
      tries += 1;
      try {
        var res = await fetch(URL, { cache: "no-store", credentials: "include" });
        if (res.status === 401 || res.status === 403) throw new Error("auth");
        var data = await res.json();
        var status = data && data.order && data.order.status;
        if (status === "CONFIRMED") {
          go(ORDER + "&status=confirmed");
          return;
        }
        if (status === "FAILED" || status === "CANCELLED" || status === "REFUNDED") {
          go(ORDER + "&status=" + encodeURIComponent(status.toLowerCase()));
          return;
        }
      } catch (err) {
        // transient/network/auth errors — keep polling; the webhook settles anyway.
      }
      if (tries >= MAX_TRIES) {
        setTimeout(function () {
          window.location.reload();
        }, 3000);
        return;
      }
      setTimeout(poll, INTERVAL);
    }

    setTimeout(poll, 500);
  })();
</script>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}