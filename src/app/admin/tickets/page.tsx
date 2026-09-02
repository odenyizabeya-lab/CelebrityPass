import Link from "next/link";
import { getTicketStats, listAdminInventory } from "@/lib/ticketing/service";
import { formatTicketPrice } from "@/lib/ticketing/helpers";
import { orderStatusLabel } from "@/lib/ticketing/types";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const [stats, sellable, ticketSources] = await Promise.all([
    getTicketStats(),
    listAdminInventory(params.status ? { status: params.status } : {}),
    prisma.eventSource.findMany({ where: { supportsTickets: true }, select: { id: true, name: true, ticketsLastSyncStatus: true, ticketsLastSyncAt: true } }),
  ]);

  const totalOrders = stats.byStatus.reduce((n, s) => n + s._count._all, 0);
  const confirmed = stats.byStatus.find((s) => s.status === "CONFIRMED")?._count._all ?? 0;
  const sellableCount = sellable.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Tickets</h1>
          <p className="mt-1 text-sm text-zinc-400">Real ticket inventory, orders, sources, and settlement — nothing simulated.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total orders" value={String(totalOrders)} />
        <StatCard label="Confirmed & paid" value={String(confirmed)} />
        <StatCard label="Gross confirmed revenue" value={formatTicketPrice(stats.revenueCents)} />
        <StatCard label="Inventory lines" value={String(stats.inventoryCount)} />
      </div>

      {/* Quick nav */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/tickets/inventory" className="glass card-hover rounded-2xl p-5">
          <p className="text-sm font-black uppercase tracking-widest text-zinc-500">Inventory</p>
          <p className="mt-2 text-2xl font-black text-white">{sellableCount}</p>
          <p className="mt-1 text-xs text-zinc-500">Ticket types reported by connected sources · read-only</p>
        </Link>
        <Link href="/admin/tickets/orders" className="glass card-hover rounded-2xl p-5">
          <p className="text-sm font-black uppercase tracking-widest text-zinc-500">Orders</p>
          <p className="mt-2 text-2xl font-black text-white">{totalOrders}</p>
          <p className="mt-1 text-xs text-zinc-500">Every order, its payment, and its real status</p>
        </Link>
        <Link href="/admin/tickets/sources" className="glass card-hover rounded-2xl p-5">
          <p className="text-sm font-black uppercase tracking-widest text-zinc-500">Ticket sources</p>
          <p className="mt-2 text-2xl font-black text-white">{ticketSources.length}</p>
          <p className="mt-1 text-xs text-zinc-500">Provider-backed sources with ticket sync enabled</p>
        </Link>
        <Link href="/admin/tickets/payments" className="glass card-hover rounded-2xl p-5">
          <p className="text-sm font-black uppercase tracking-widest text-zinc-500">Payments</p>
          <p className="text-2xl font-black text-white">{stats.paymentMethods.length}</p>
          <p className="mt-1 text-xs text-zinc-500">Configured payment methods & settlements</p>
        </Link>
        <Link href="/admin/tickets/inventory" className="glass card-hover rounded-2xl p-5">
          <p className="text-sm font-black uppercase tracking-widest text-zinc-500">Sellable now</p>
          <p className="text-2xl font-black text-emerald-300">{sellableCount}</p>
          <p className="mt-1 text-xs text-zinc-500">AVAILABLE / LIMITED ticket types with stock</p>
        </Link>
      </div>

      {/* Ticket sources health */}
      <section className="mt-8">
        <h2 className="text-lg font-black">Ticket source health</h2>
        {ticketSources.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No source has ticket sync enabled. Enable it on the Event Sources page to pull real inventory.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-widest text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Last sync</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {ticketSources.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {s.ticketsLastSyncAt ? new Date(s.ticketsLastSyncAt).toLocaleString() : "never"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                          s.ticketsLastSyncStatus === "success"
                            ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                            : s.ticketsLastSyncStatus === "error"
                              ? "bg-rose-500/15 text-rose-300 ring-rose-400/30"
                              : "bg-white/5 text-zinc-400 ring-white/10"
                        }`}
                      >
                        {s.ticketsLastSyncStatus ?? "idle"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent orders */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Recent orders</h2>
          <Link href="/admin/tickets/orders" className="text-sm font-semibold text-zinc-400 hover:text-white">
            All orders →
          </Link>
        </div>
        {stats.recentOrders.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No orders yet. Orders appear when customers place them on the public site.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {stats.recentOrders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/tickets/orders/${o.id}`}
                className="glass card-hover flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    <span className="font-mono">{o.orderRef}</span> · {o.event.name}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {o.customerName} · {o.customerEmail}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-zinc-400">{formatTicketPrice(o.totalCents, o.currency)}</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                      o.status === "CONFIRMED"
                        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                        : o.status === "PENDING_PAYMENT"
                          ? "bg-amber-500/15 text-amber-300 ring-amber-400/30"
                          : o.status === "FAILED"
                            ? "bg-rose-500/15 text-rose-300 ring-rose-400/30"
                            : "bg-white/5 text-zinc-400 ring-white/10"
                    }`}
                  >
                    {orderStatusLabel(o.status)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}