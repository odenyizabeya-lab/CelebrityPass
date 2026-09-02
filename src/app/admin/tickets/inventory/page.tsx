import Link from "next/link";
import { listAdminInventory } from "@/lib/ticketing/service";
import { formatTicketPrice } from "@/lib/ticketing/helpers";
import { inventoryStatusLabel } from "@/lib/ticketing/types";

export const dynamic = "force-dynamic";

const STATUSES = ["", "AVAILABLE", "LIMITED", "SOLD_OUT", "NOT_YET_ON_SALE", "UNAVAILABLE"] as const;

export default async function AdminInventoryPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  const rows = await listAdminInventory({ status: status || null, search: q || null });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Ticket inventory</h1>
          <p className="mt-1 text-sm text-zinc-400">Read-only: inventory is written only by authorized ticket sources during sync.</p>
        </div>
      </div>

      <form method="GET" className="mt-5 flex flex-wrap items-center gap-3">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search ticket type, event, celebrity…"
          className="w-full max-w-xs rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-white ring-1 ring-white/10 outline-none transition placeholder:text-zinc-600 focus:ring-2 focus:ring-primary-400"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-white ring-1 ring-white/10 outline-none"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} className="bg-zinc-900">
              {s === "" ? "All statuses" : inventoryStatusLabel(s)}
            </option>
          ))}
        </select>
        <button className="rounded-full px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/5">
          Filter
        </button>
        {q || status ? (
          <Link href="/admin/tickets/inventory" className="text-sm text-zinc-400 hover:text-white">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-5 overflow-x-auto">
        <Link href="/admin/tickets" className="text-sm font-semibold text-zinc-400 transition hover:text-white">← Tickets</Link>
        {rows.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-zinc-800/40 px-5 py-6 text-sm text-zinc-400 ring-1 ring-white/10">
            No ticket inventory found. Connect a ticket source and run a sync to pull real inventory.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-widest text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Qty avail</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Last synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{r.name}</p>
                      {r.category && <p className="text-xs text-zinc-500">{r.category}</p>}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      <p className="line-clamp-1 max-w-[220px]">{r.event.name}</p>
                      <p className="text-xs text-zinc-500">{r.event.celebrity.name}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-200">
                      {formatTicketPrice(r.priceCents, r.currency)}
                      {r.feesCents > 0 && <span className="block text-xs text-zinc-500">+{formatTicketPrice(r.feesCents, r.currency)} fees</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-300 ring-1 ring-white/10">
                        {inventoryStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{r.quantityAvailable ?? "n/a"}</td>
                    <td className="px-4 py-3 text-zinc-400">{r.source?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">{r.lastSyncedAt ? new Date(r.lastSyncedAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}