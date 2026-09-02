import Link from "next/link";
import { listAdminOrders } from "@/lib/ticketing/service";
import { formatTicketPrice } from "@/lib/ticketing/helpers";
import { orderStatusLabel } from "@/lib/ticketing/types";

export const dynamic = "force-dynamic";

const STATUSES = ["", "PENDING_PAYMENT", "PAYMENT_PROCESSING", "CONFIRMED", "FAILED", "CANCELLED", "REFUNDED"] as const;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  const orders = await listAdminOrders({ status: status || null, search: q || null });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Ticket orders</h1>
          <p className="mt-1 text-sm text-zinc-400">Every order placed on the public site, with real payment state.</p>
        </div>
        <Link href="/admin/tickets" className="text-sm font-semibold text-zinc-400 transition hover:text-white">← Tickets</Link>
      </div>

      <form method="GET" className="mt-5 flex flex-wrap items-center gap-3">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search order ref, name, email, event…"
          className="w-full max-w-xs rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-white ring-1 ring-white/10 outline-none transition placeholder:text-zinc-600 focus:ring-2 focus:ring-primary-400"
        />
        <select name="status" defaultValue={status ?? ""} className="rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-white ring-1 ring-white/10 outline-none">
          {STATUSES.map((s) => (
            <option key={s} value={s} className="bg-zinc-900">
              {s === "" ? "All statuses" : orderStatusLabel(s)}
            </option>
          ))}
        </select>
        <button className="rounded-full px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/5">
          Filter
        </button>
        {q || status ? (
          <Link href="/admin/tickets/orders" className="text-sm text-zinc-400 hover:text-white">Clear</Link>
        ) : null}
      </form>

      {orders.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-zinc-800/40 px-5 py-6 text-sm text-zinc-400 ring-1 ring-white/10">
          No orders match. Orders appear when customers place them.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <div className="overflow-hidden rounded-2xl ring-1 ring-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-widest text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {orders.map((o) => {
                  const qty = o.items.reduce((n, i) => n + i.quantity, 0);
                  return (
                    <tr key={o.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <Link href={`/admin/tickets/orders/${o.id}`} className="font-mono font-semibold text-white underline-offset-2 hover:underline">
                          {o.orderRef}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-zinc-200">{o.customerName}</p>
                        <p className="text-xs text-zinc-500">{o.customerEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        <p className="line-clamp-1 max-w-[200px]">{o.event.name}</p>
                        <p className="text-xs text-zinc-500">{o.event.celebrity.name}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-200">
                        {formatTicketPrice(o.totalCents, o.currency)}
                        <span className="block text-xs text-zinc-500">× {qty}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={o.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{o.paymentStatus}</td>
                      <td className="px-4 py-3 text-zinc-500">{new Date(o.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "CONFIRMED"
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
      : status === "PENDING_PAYMENT"
        ? "bg-amber-500/15 text-amber-300 ring-amber-400/30"
        : status === "FAILED"
          ? "bg-rose-500/15 text-rose-300 ring-rose-400/30"
          : status === "REFUNDED"
            ? "bg-sky-500/15 text-sky-300 ring-sky-400/30"
            : "bg-white/5 text-zinc-400 ring-white/10";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`}>{orderStatusLabel(status)}</span>;
}