import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EventStatusBadge, { VerificationPill } from "@/components/events/EventStatusBadge";
import EventCountdown from "@/components/events/EventCountdown";
import EventActions from "@/components/events/EventActions";
import TicketsSection from "@/components/tickets/TicketsSection";
import { getEventById } from "@/lib/events/service";
import { formatEventTime, friendlyTimezone, formatEventDate } from "@/lib/events/helpers";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const event = await getEventById(eventId);
  return {
    title: event ? `${event.name} — ${event.celebrityName}` : "Event not found",
    description: event?.description ?? undefined,
  };
}

export default async function EventDetailsPage({ params }: Props) {
  const { slug, eventId } = await params;
  const event = await getEventById(eventId);
  if (!event || event.celebritySlug !== slug) notFound();

  const { date, weekday, time } = formatEventDate(event.startAt, event.timezone);
  const location = [event.venue, event.city, event.region, event.country].filter(Boolean).join(", ");
  const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/celebrity/${event.celebritySlug}/event/${event.eventId}`;

  return (
    <div>
      {/* header band */}
      <div
        className="h-44 w-full"
        style={{ background: "linear-gradient(115deg, #27104a, #0b0c10)" }}
      />
      <div className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        <Link href={`/celebrity/${event.celebritySlug}`} className="text-sm font-semibold text-zinc-400 transition hover:text-white">
          ← {event.celebrityName}&apos;s profile
        </Link>

        <div className="mt-6 rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 ring-1 ring-white/10 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <EventStatusBadge status={event.status} verification={event.verification} />
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-zinc-400 ring-1 ring-white/10">
              {event.type}
            </span>
            <VerificationPill verification={event.verification} />
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{event.name}</h1>
          <p className="mt-2 text-zinc-300">
            {event.celebrityName} · {date}
          </p>

          {event.status === "HAPPENING_NOW" && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-500/20 px-4 py-2 text-sm font-black text-rose-300 ring-1 ring-rose-400/40">
              <span className="h-2.5 w-2.5 animate-ping rounded-full bg-rose-400" />
              Happening now
            </div>
          )}
          {event.status === "UPCOMING" && (
            <EventCountdown startAt={event.startAt} className="mt-4 inline-block rounded-xl bg-emerald-500/10 px-4 py-2 font-mono text-lg font-black text-emerald-300 ring-1 ring-emerald-400/30" />
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoItem label="Date" value={`${weekday}, ${date}`} />
            <InfoItem label="Start time" value={time} />
            {event.endAt && <InfoItem label="End time" value={formatEventTime(event.endAt, event.timezone)} />}
            <InfoItem label="Timezone" value={friendlyTimezone(event.timezone) ?? "Local venue time"} />
            {event.venue && <InfoItem label="Venue" value={event.venue} />}
            {location && <InfoItem label="Location" value={location} />}
          </div>

          {event.description && (
            <div className="mt-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">About this event</h2>
              <p className="mt-2 leading-relaxed text-zinc-300">{event.description}</p>
            </div>
          )}

          {(event.officialUrl || event.ticketUrl) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {event.officialUrl && (
                <a
                  href={event.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-grad inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white"
                >
                  Official event page
                  <span>↗</span>
                </a>
              )}
              {event.ticketUrl && (
                <a
                  href={event.ticketUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/5"
                >
                  Official tickets
                  <span>↗</span>
                </a>
              )}
            </div>
          )}

          <div className="mt-6 border-t border-white/10 pt-6">
            <EventActions
              event={event}
              shareUrl={shareUrl}
            />
          </div>

          <TicketsSection event={event} />

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
            {event.lastSyncedAt && (
              <span>Last synchronized: {new Date(event.lastSyncedAt).toLocaleString()}</span>
            )}
            <span>Last updated: {new Date(event.updatedAt).toLocaleString()}</span>
            {event.sourceUrl && (
              <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="underline transition hover:text-white">
                Original public source ↗
              </a>
            )}
            <span>Event ref: {event.eventId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
      <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
