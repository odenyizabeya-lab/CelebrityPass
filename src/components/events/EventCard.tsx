"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import EventStatusBadge from "./EventStatusBadge";
import EventCountdown from "./EventCountdown";
import { formatEventDate } from "@/lib/events/helpers";
import type { EventSummary } from "@/lib/events/service";

/**
 * A clean, responsive event card. No horizontal overflow by design (fixed
 * 12-col grid; long text truncates). Clicking opens the event details page.
 */
export default function EventCard({
  event,
  accentColor = "#8b5cf6",
  showCountdown = true,
}: {
  event: EventSummary;
  accentColor?: string;
  showCountdown?: boolean;
}) {
  const router = useRouter();
  const { date, weekday, time } = formatEventDate(event.startAt, event.timezone);
  const href = `/celebrity/${event.celebritySlug}/event/${event.eventId}`;
  const location = [event.city, event.region, event.country].filter(Boolean).join(", ");
  const happening = event.status === "HAPPENING_NOW";

  return (
    <Link
      href={href}
      className="glass card-hover group relative flex flex-col overflow-hidden rounded-2xl p-5 sm:flex-row sm:items-center sm:gap-6"
      style={{ borderColor: happening ? "rgba(244,63,94,0.4)" : undefined }}
    >
      {/* Date block */}
      <div
        className="flex w-full shrink-0 items-start gap-4 sm:w-24 sm:flex-col sm:items-center sm:gap-1 sm:rounded-xl sm:py-3 sm:text-center"
        style={{ backgroundColor: `${accentColor}1a`, border: `1px solid ${accentColor}33` }}
      >
        <div className="text-sm font-black uppercase tracking-widest" style={{ color: accentColor }}>
          {weekday}
        </div>
        <div className="text-xl font-black text-white">{date.replace(String(new Date(event.startAt).getFullYear()), "").trim()}</div>
        <div className="text-xs font-semibold text-zinc-400 sm:mt-2">{time}</div>
      </div>

      {/* Main info */}
      <div className="mt-4 min-w-0 flex-1 sm:mt-0">
        <div className="flex flex-wrap items-center gap-2">
          <EventStatusBadge status={event.status} verification={event.verification} />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{event.type}</span>
        </div>
        <h3 className="mt-2 truncate text-lg font-bold text-white group-hover:underline">{event.name}</h3>
        {location && <p className="mt-1 truncate text-sm text-zinc-400">📌 {location}</p>}
        {event.venue && <p className="mt-0.5 truncate text-sm text-zinc-500">{event.venue}</p>}
      </div>

      {/* Countdown / status */}
      <div className="mt-4 flex shrink-0 items-center justify-between gap-4 sm:mt-0 sm:flex-col sm:items-end">
        {event.ticketsAvailable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              router.push(`/celebrity/${event.celebritySlug}/event/${event.eventId}/tickets`);
            }}
            className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25"
          >
            🎟️ Tickets available
          </button>
        )}
        {happening ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-1.5 text-xs font-black text-rose-300 ring-1 ring-rose-400/40">
            <span className="h-2 w-2 animate-ping rounded-full bg-rose-400" />
            Happening now
          </span>
        ) : event.status === "UPCOMING" && showCountdown ? (
          <EventCountdown startAt={event.startAt} compact className="font-mono text-sm font-bold text-emerald-300" />
        ) : (
          <span className="text-xs text-zinc-500">View details</span>
        )}
        <span className="text-zinc-500 transition group-hover:translate-x-1 group-hover:text-white">→</span>
      </div>
    </Link>
  );
}
