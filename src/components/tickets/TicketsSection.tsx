// Server-side "Tickets" section for an event details page. Renders real
// inventory from the DB only; every state is honest (no fake availability).
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { getEventTicketView } from "@/lib/ticketing/service";
import { formatTicketPrice } from "@/lib/ticketing/helpers";
import type { EventSummary } from "@/lib/events/service";

export default async function TicketsSection({ event }: { event: EventSummary }) {
  const view = await getEventTicketView(event.eventId);
  if (!view) return null;

  const sellable = view.tickets.filter((t) => t.sellable);
  const others = view.tickets.filter((t) => !t.sellable);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-lg ring-1 ring-white/10">🎟️</span>
          <h2 className="text-xl font-black tracking-tight">Tickets</h2>
        </div>
        {view.ticketLastSyncedAt && (
          <span className="text-[11px] text-zinc-500">
            Availability last synchronized {new Date(view.ticketLastSyncedAt).toLocaleString()}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {event.status === "CANCELLED" && (
          <p className="rounded-2xl bg-zinc-800/40 px-5 py-4 text-sm text-zinc-400 ring-1 ring-white/10">
            This event was publicly cancelled. Tickets are not available.
          </p>
        )}
        {event.status === "POSTPONED" && (
          <p className="rounded-2xl bg-amber-500/10 px-5 py-4 text-sm text-amber-200/90 ring-1 ring-amber-400/20">
            This event has been postponed. Check back for the rescheduled date; tickets are not being sold right now.
          </p>
        )}

        {event.status === "UPCOMING" && (
          <>
            {sellable.length === 0 && others.length === 0 && (
              <EmptyState
                title="No tickets listed"
                message="No ticket inventory has been reported by our connected ticket sources for this event."
              />
            )}

            {sellable.map((t) => (
              <div key={t.inventoryId} className="glass flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-400/30">
                      {t.category ? `${t.category} · ` : ""}Available
                    </span>
                    {t.sourceName && <span className="text-[11px] text-zinc-500">via {t.sourceName}</span>}
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-white">{t.name}</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    {formatTicketPrice(t.priceCents, t.currency)}
                    {t.feesCents > 0 ? ` + ${formatTicketPrice(t.feesCents, t.currency)} fees` : ""} per ticket
                    {t.quantityAvailable != null && ` · ${t.quantityAvailable} left`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`/celebrity/${event.celebritySlug}/event/${event.eventId}/tickets`}
                    className="btn-grad rounded-full px-5 py-2.5 text-sm font-bold text-white"
                  >
                    Select tickets
                  </Link>
                  {t.url && (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/5"
                    >
                      Buy at official seller ↗
                    </a>
                  )}
                </div>
              </div>
            ))}

            {others.map((t) => (
              <div key={t.inventoryId} className="glass flex flex-col gap-3 rounded-2xl p-5 opacity-70 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span className="rounded-full bg-zinc-500/15 px-2.5 py-1 text-[11px] font-bold text-zinc-400 ring-1 ring-white/10">
                    {t.status === "SOLD_OUT" ? "Sold out" : t.status === "NOT_YET_ON_SALE" ? "Not on sale yet" : "Not available"}
                  </span>
                  <h3 className="mt-2 text-lg font-bold text-white">{t.name}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{formatTicketPrice(t.priceCents, t.currency)} per ticket</p>
                </div>
                {t.url && (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/5"
                  >
                    Official seller ↗
                  </a>
                )}
              </div>
            ))}

            {sellable.length === 0 && event.ticketUrl && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
                <p className="text-sm text-zinc-300">Tickets may be available at the official ticket source for this event.</p>
                <a
                  href={event.ticketUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-grad rounded-full px-5 py-2.5 text-sm font-bold text-white"
                >
                  Visit official ticket source ↗
                </a>
              </div>
            )}

            {view.ticketLastSyncedAt && (
              <p className="text-xs text-zinc-600">
                Availability is shown exactly as last reported by the connected ticket source — it may not be real-time.
              </p>
            )}
          </>
        )}

        {(event.status === "HAPPENING_NOW" || event.status === "COMPLETED") && (
          <EmptyState title="Tickets are no longer available" message="This event has already started or ended." />
        )}
      </div>
    </section>
  );
}