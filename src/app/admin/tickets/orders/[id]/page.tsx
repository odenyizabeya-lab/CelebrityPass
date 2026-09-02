import Link from "next/link";
import { notFound } from "next/navigation";
import AdminOrderActions from "@/components/tickets/AdminOrderActions";
import { getAdminOrder } from "@/lib/ticketing/service";
import { formatTicketPrice, parseStatusHistory } from "@/lib/ticketing/helpers";
import { orderStatusLabel, paymentStatusLabel, deliveryMethodLabel } from "@/lib/ticketing/types";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getAdminOrder(id);
  if (!order) notFound();

  const history = parseStatusHistory(order.statusHistoryJson);
  const canRefund = order.paymentStatus === "PAID";

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/tickets/orders" className="text-sm font-semibold text-zinc-400 transition hover:text-white">← All orders</Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-black tracking-tight">{order.orderRef}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {order.customerName} · {order.customerEmail}
            {order.customerPhone ? ` · ${order.customerPhone}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-widest ring-1 ring-white/10">
            {orderStatusLabel(order.status)}
          </span>
          <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-widest ring-1 ring-white/10">
            {paymentStatusLabel(order.paymentStatus)}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Event</p>
          <p className="mt-1 text-lg font-bold text-white">{order.event.name}</p>
          <p className="text-sm text-zinc-400">
            {order.event.celebrity.name} · {new Date(order.event.startAt).toLocaleString()}
          </p>
          {order.event.ticketUrl && (
            <a href={order.event.ticketUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-zinc-300 underline hover:text-white">
              Official ticket source ↗
            </a>
          )}
          <p className="mt-2 text-sm text-zinc-400">
            View as customer:{" "}
            <Link href={`/order/${order.orderRef}?t=${order.accessToken}`} className="font-mono text-xs text-zinc-300 underline hover:text-white">
              /order/{order.orderRef}?t=…
            </Link>
          </p>
        </div>

        <div className="glass rounded-2xl p-5">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Money</p>
          <dl className="mt-2 space-y-1.5 text-sm text-zinc-300">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatTicketPrice(order.subtotalCents, order.currency)}</dd></div>
            <div className="flex justify-between"><dt>Fees</dt><dd>{formatTicketPrice(order.feesCents, order.currency)}</dd></div>
            <div className="flex justify-between text-lg font-black text-white"><dt>Total</dt><dd>{formatTicketPrice(order.totalCents, order.currency)}</dd></div>
            <div className="flex justify-between text-zinc-400"><dt>Amount actually paid</dt><dd>{order.amountPaidCents != null ? formatTicketPrice(order.amountPaidCents, order.currency) : "—"}</dd></div>
            <div className="flex justify-between text-zinc-400"><dt>Method</dt><dd>{order.paymentMethod?.name ?? "—"}</dd></div>
            <div className="flex justify-between text-zinc-400"><dt>Delivery</dt><dd>{deliveryMethodLabel(order.deliveryMethod)}</dd></div>
          </dl>
          {order.paymentRef && (
            <p className="mt-2 text-xs text-zinc-500">Payment ref: <span className="font-mono text-zinc-300">{order.paymentRef}</span></p>
          )}
        </div>
      </div>

      <div className="mt-4 glass rounded-2xl p-5">
        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Items</p>
        <div className="mt-2 space-y-2 text-sm">
          {order.items.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{i.ticketName} <span className="font-normal text-zinc-400">× {i.quantity}</span></p>
                {i.category && <p className="text-xs text-zinc-500">{i.category}</p>}
              </div>
              <p className="font-bold text-white">{formatTicketPrice(i.subtotalCents + i.feesEachCents * i.quantity, i.currency)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 glass rounded-2xl p-5">
        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Transactions</p>
        {order.transactions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No transactions yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {order.transactions.map((tx) => (
              <li key={tx.id} className="rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-white">{tx.kind === "PAYMENT" ? "Payment" : "Refund"} · {tx.status}</span>
                  <span className="text-xs text-zinc-500">{formatTicketPrice(tx.amountCents, tx.currency)} · {new Date(tx.createdAt).toLocaleString()}</span>
                </div>
                {tx.message && <p className="mt-1 text-xs text-zinc-400">{tx.message}</p>}
                {tx.providerRef && <p className="mt-1 text-xs text-zinc-500">Ref: <span className="font-mono">{tx.providerRef}</span></p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-4 glass rounded-2xl p-5">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Status history</p>
          <ul className="mt-2 space-y-1.5 text-sm text-zinc-400">
            {[...history].reverse().map((h, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                <span>{orderStatusLabel(h.status)}{h.note ? ` — ${h.note}` : ""}</span>
                <span className="text-xs text-zinc-600">{new Date(h.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.notes && (
        <div className="mt-4 glass rounded-2xl p-5">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Notes</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-zinc-300">{order.notes}</pre>
        </div>
      )}

      <div className="mt-6">
        <AdminOrderActions orderId={order.id} canRefund={canRefund} />
      </div>
    </div>
  );
}