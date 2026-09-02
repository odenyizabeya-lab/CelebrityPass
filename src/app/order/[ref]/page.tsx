import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import OrderActions from "@/components/tickets/OrderActions";
import UniversalCheckout from "@/components/payments/UniversalCheckout";
import { getOrderForHolder } from "@/lib/ticketing/service";
import { formatTicketPrice, parseStatusHistory } from "@/lib/ticketing/helpers";
import { orderStatusLabel, paymentStatusLabel, deliveryMethodLabel } from "@/lib/ticketing/types";
import { prisma } from "@/lib/db";
import { buildPaymentMethods, type UniversalMethods } from "@/lib/ticketing/universal";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ ref: string }>; searchParams: Promise<{ t?: string; created?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ref } = await params;
  return { title: `Order ${ref}` };
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { ref } = await params;
  const { t: token, created } = await searchParams;

  const order = token ? await getOrderForHolder(ref, token) : null;
  const safe = order ? null : await getOrderSafe(ref);
  if (!order && !safe) notFound();

  let pay: UniversalMethods | null = null;
  if (
    order &&
    (order.status === "PENDING_PAYMENT" ||
      order.status === "PAYMENT_PROCESSING" ||
      order.status === "FAILED")
  ) {
    pay = await buildPaymentMethods({
      kind: "TICKET",
      id: order.id,
      ref: order.orderRef,
      title: `Tickets — ${order.event.name}`,
      amountCents: order.totalCents,
      currency: order.currency || "USD",
    });
  }

  // If the customer already has an unverified bank proof, show pending state.
  let pendingProof: { id: string; reference: string | null } | null = null;
  if (order) {
    pendingProof = await prisma.bankTransferProof.findFirst({
      where: { ticketOrderId: order.id, status: "PENDING_VERIFICATION" },
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true },
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">
      {!order && safe && (
        <>
          <h1 className="text-3xl font-black tracking-tight">Order {safe.orderRef}</h1>
          <div className="mt-6">
            <EmptyState
              title={safe.status === "CONFIRMED" ? "Order confirmed" : orderStatusLabel(safe.status)}
              message="Login to this order with your access link (the ?t= token) to manage it." 
            />
          </div>
        </>
      )}

      {order && <OrderBody order={order} created={Boolean(created)} pay={pay} pendingProof={pendingProof} />}
    </div>
  );
}

function OrderBody({
  order,
  created,
  pay,
  pendingProof,
}: {
  order: NonNullable<Awaited<ReturnType<typeof getOrderForHolder>>>;
  created: boolean;
  pay: UniversalMethods | null;
  pendingProof: { id: string; reference: string | null } | null;
}) {
  const confirmed = order.status === "CONFIRMED";
  const pending = order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_PROCESSING" || order.status === "FAILED";
  const closed = order.status === "CANCELLED" || order.status === "REFUNDED";
  const history = parseStatusHistory(order.statusHistoryJson);

  return (
    <div>
      {/* header */}
      <div className={`rounded-3xl p-6 ring-1 ${confirmed ? "bg-emerald-500/10 ring-emerald-400/25" : "glass"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Order {order.orderRef}</h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${
              confirmed ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" : closed ? "bg-zinc-800 text-zinc-400 ring-white/10" : "bg-amber-500/15 text-amber-300 ring-amber-400/30"
            }`}
          >
            {orderStatusLabel(order.status)}
          </span>
        </div>
        <p className="mt-1 text-zinc-400">
          Payment: {paymentStatusLabel(order.paymentStatus)}
          {order.paidAt ? ` · paid ${new Date(order.paidAt).toLocaleString()}` : ""}
        </p>

        {created && !confirmed && (
          <p className="mt-4 rounded-xl bg-white/[0.05] px-4 py-3 text-sm text-zinc-300 ring-1 ring-white/10">
            Your order was saved. Complete payment below — nothing is charged until you pay and nothing is confirmed until the
            payment succeeds.
          </p>
        )}
      </div>

      {/* confirmation (only real) */}
      {confirmed && (
        <div className="mt-6 rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">✓</span>
            <h2 className="text-lg font-black text-white">Payment successful — your order is confirmed</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Amount paid: <strong className="text-white">{formatTicketPrice(order.amountPaidCents ?? order.totalCents, order.currency)}</strong>
            {order.paymentRef ? <> · payment ref <span className="font-mono text-white">{order.paymentRef}</span></> : null}
            {order.paidAt ? <> · {new Date(order.paidAt).toLocaleString()}</> : null}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Delivery: {deliveryMethodLabel(order.deliveryMethod)}
            {order.deliveryDetail ? <span className="mt-1 block text-zinc-500">{order.deliveryDetail}</span> : null}
          </p>
          <p className="mt-3 rounded-xl bg-white/[0.04] px-4 py-3 text-xs leading-relaxed text-zinc-400 ring-1 ring-white/10">
            Your tickets are issued by the official ticket source tied to this event. This confirmation only records the successful
            payment — the ticket itself comes from the authorized seller.
          </p>
        </div>
      )}

      {/* event */}
      <div className="mt-6 glass rounded-2xl p-5">
        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Event</p>
        <p className="mt-1 text-lg font-bold text-white">{order.event.name}</p>
        <p className="text-sm text-zinc-400">
          {order.event.celebrity.name} · {new Date(order.event.startAt).toLocaleString()}
        </p>
        <Link
          href={`/celebrity/${order.event.celebrity.slug}/event/${order.event.eventId}`}
          className="mt-2 inline-block text-sm font-semibold text-zinc-300 underline transition hover:text-white"
        >
          View event →
        </Link>
      </div>

      {/* items + totals */}
      <div className="mt-6 glass rounded-2xl p-5">
        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Items</p>
        <div className="mt-3 space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold text-white">
                  {item.ticketName} <span className="text-zinc-400">× {item.quantity}</span>
                </p>
                {item.category && <p className="text-xs text-zinc-500">{item.category}</p>}
              </div>
              <p className="font-bold text-white">{formatTicketPrice(item.subtotalCents + item.feesEachCents * item.quantity, item.currency)}</p>
            </div>
          ))}
        </div>
        <dl className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-sm text-zinc-300">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatTicketPrice(order.subtotalCents, order.currency)}</dd></div>
          <div className="flex justify-between"><dt>Fees</dt><dd>{formatTicketPrice(order.feesCents, order.currency)}</dd></div>
          <div className="flex justify-between text-lg font-black text-white"><dt>Total</dt><dd>{formatTicketPrice(order.totalCents, order.currency)}</dd></div>
        </dl>
      </div>

      {/* payment / manage */}
      {pending && (
        <div className="mt-6 glass rounded-2xl p-5">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Payment</p>
          {order.status === "FAILED" && (
            <p className="mt-2 text-sm text-zinc-400">Your last payment attempt failed. You can pay below or cancel the order.</p>
          )}

          {pendingProof ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-2xl font-black text-emerald-900">✓</div>
              <h3 className="mt-4 text-lg font-black text-white">Transfer submitted for verification</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-emerald-200/80">
                We&apos;ve received your transfer details and proof
                {pendingProof.reference ? <span className="font-mono"> ({pendingProof.reference})</span> : null}. This order
                stays <span className="font-semibold text-emerald-200">Pending Verification</span> until we confirm the funds
                have arrived.
              </p>
            </div>
          ) : pay ? (
            <div className="mt-4">
              <UniversalCheckout
                kind="TICKET"
                methods={pay.methods}
                defaultMethod={pay.defaultMethod}
                amountCents={order.totalCents}
                currency={order.currency || "USD"}
                purchaseTitle={`Tickets — ${order.event.name}`}
                accent="#10b981"
                redirectUrl={`/order/${order.orderRef}?t=${order.accessToken}`}
                orderRef={order.orderRef}
              />
              <div className="mt-6 border-t border-white/10 pt-4">
                <OrderActions orderRef={order.orderRef} token={order.accessToken} />
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <OrderActions orderRef={order.orderRef} token={order.accessToken} />
            </div>
          )}
        </div>
      )}

      {/* transactions */}
      {order.transactions.length > 0 && (
        <div className="mt-6 glass rounded-2xl p-5">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Transaction history</p>
          <ul className="mt-3 space-y-2 text-sm">
            {order.transactions.map((tx) => (
              <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-zinc-300">
                  {tx.kind === "PAYMENT" ? "Payment" : "Refund"} ·{" "}
                  {tx.status === "SUCCEEDED" ? (
                    <span className="font-semibold text-emerald-300">succeeded</span>
                  ) : tx.status === "FAILED" ? (
                    <span className="font-semibold text-rose-300">failed</span>
                  ) : tx.status === "PROCESSING" ? (
                    <span className="font-semibold text-amber-300">processing</span>
                  ) : (
                    <span className="font-semibold text-zinc-300">initiated</span>
                  )}
                </span>
                <span className="text-zinc-500">{new Date(tx.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          {order.transactions.some((tx) => tx.status === "FAILED" || tx.status === "INITIATED") && (
            <p className="mt-3 text-xs text-zinc-500">
              {order.transactions
                .filter((tx) => tx.status === "FAILED" || tx.status === "INITIATED")
                .map((tx) => tx.message)
                .filter(Boolean)
                .join(" ")}
            </p>
          )}
        </div>
      )}

      {/* history */}
      {history.length > 0 && (
        <div className="mt-6 glass rounded-2xl p-5">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Order history</p>
          <ul className="mt-3 space-y-1.5 text-sm text-zinc-400">
            {[...history].reverse().map((h, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-semibold text-zinc-300">{orderStatusLabel(h.status)}</span>
                  {h.note ? ` — ${h.note}` : ""}
                </span>
                <span className="text-xs text-zinc-600">{new Date(h.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

async function getOrderSafe(ref: string) {
  const order = await prisma.ticketOrder.findUnique({
    where: { orderRef: ref },
    select: { orderRef: true, status: true, paymentStatus: true },
  });
  return order;
}