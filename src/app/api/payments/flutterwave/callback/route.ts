// GET /api/payments/flutterwave/callback — Flutterwave redirects the customer
// here after reaching the hosted checkout page. Settlement is NEVER driven from
// this redirect: a card is only ever issued by the webhook after a server-side
// GET /charges/{id} re-check. This route:
//   1. marks the payment FAILED when Flutterwave reports an explicit
//      failed/cancelled/expired outcome in the query string,
//   2. sends a settled customer straight to their card page,
//   3. otherwise shows a lightweight "confirming payment" page that polls the
//      payment status API until the webhook settles it (or it fails/times out).
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

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
  const paymentId = (searchParams.get("ref") || "").trim();
  const txRef = (searchParams.get("tx_ref") || searchParams.get("reference") || "").trim();
  if (!paymentId && !txRef) return NextResponse.redirect(request.nextUrl.origin);

  const payment = await prisma.payment.findUnique({
    where: paymentId ? { id: paymentId } : { gatewayRef: txRef },
    include: {
      celebrity: { select: { slug: true, name: true } },
    },
  });
  if (!payment || payment.provider !== "flutterwave") {
    return NextResponse.redirect(request.nextUrl.origin);
  }

  const host = request.nextUrl.origin;
  const checkout = (extra: string) => NextResponse.redirect(`${host}/checkout/${payment.id}${extra}`);

  // Flutterwave reports a user cancelling (or the attempt failing) via ?status=…
  const statusParam = (searchParams.get("status") ?? "").toLowerCase();
  if (ABANDONED_STATUSES.has(statusParam) && payment.status === "PENDING") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return checkout(`?status=${statusParam}`);
  }

  if (payment.status === "PAID" && payment.cardId) {
    const card = await prisma.fanCard.findUnique({ where: { id: payment.cardId } });
    if (card && payment.celebrity) {
      return NextResponse.redirect(`${host}/celebrity/${payment.celebrity.slug}/fan/${card.fanNumber}`);
    }
  }

  if (payment.status === "REFUNDED") return checkout("?status=refunded");
  if (payment.status === "FAILED") return checkout("?status=failed");
  if (payment.status !== "PENDING") return checkout(`?status=${payment.status.toLowerCase()}`);
  if (SUCCESS_QUERY_STATUSES.has(statusParam)) {
    // The query string claims success — still not trusted. Show the confirming
    // page; the webhook is the source of truth.
  }

  return confirmationPage({ paymentId: payment.id, celebrity: payment.celebrity?.name ?? null });
}

function confirmationPage({ paymentId, celebrity }: { paymentId: string; celebrity: string | null }): Response {
  const pollUrl = `/api/payments/${encodeURIComponent(paymentId)}`;
  const checkoutUrl = `/checkout/${encodeURIComponent(paymentId)}`;
  const celebrityName = celebrity ? esc(celebrity) : "";

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
    <p><span class="name">${celebrityName || "Your community"}</span> — we&rsquo;re just confirming your card payment.</p>
    <p>This usually takes a few seconds. Don&rsquo;t close this window.</p>
    <div class="links">
      <a href="${checkoutUrl}">Back to checkout</a>
    </div>
    <p class="muted">If you&rsquo;re not redirected automatically, refresh this page in a moment.</p>
  </div>
<script>
  (function () {
    var URL = ${JSON.stringify(pollUrl)};
    var CHECKOUT = ${JSON.stringify(checkoutUrl)};
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
        var status = data && data.payment && data.payment.status;
        if (status === "PAID") {
          var card = data.card;
          var celeb = data.celebrity;
          if (card && card.fanNumber && celeb && celeb.slug) {
            go("/celebrity/" + encodeURIComponent(celeb.slug) + "/fan/" + encodeURIComponent(card.fanNumber));
            return;
          }
          go(CHECKOUT + "?status=paid");
          return;
        }
        if (status === "FAILED" || status === "REFUNDED") {
          go(CHECKOUT + "?status=" + encodeURIComponent(status.toLowerCase()));
          return;
        }
        if (status && status !== "PENDING") {
          go(CHECKOUT + "?status=" + encodeURIComponent(status.toLowerCase()));
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