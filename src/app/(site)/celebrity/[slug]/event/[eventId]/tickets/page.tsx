import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EventStatusBadge from "@/components/events/EventStatusBadge";
import EventCountdown from "@/components/events/EventCountdown";
import TicketPicker from "@/components/tickets/TicketPicker";
import { getEventById } from "@/lib/events/service";
import { getEventTicketView } from "@/lib/ticketing/service";
import { formatEventDate } from "@/lib/events/helpers";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; eventId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, eventId } = await params;
  const event = await getEventById(eventId);
  return { title: event && event.celebritySlug === slug ? `Tickets — ${event.name}` : "Tickets not found" };
}

export default async function TicketSelectionPage({ params }: Props) {
  const { slug, eventId } = await params;
  const event = await getEventById(eventId);
  if (!event || event.celebritySlug !== slug) notFound();

  const view = await getEventTicketView(eventId);
  if (!view) notFound();
  const { date, weekday } = formatEventDate(event.startAt, event.timezone);
  const location = [event.venue, event.city, event.country].filter(Boolean).join(", ");

  return (
    <div>
      <div className="h-32 w-full" style={{ background: "linear-gradient(115deg, #27104a, #0b0c10)" }} />
      <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <Link href={`/celebrity/${slug}/event/${eventId}`} className="text-sm font-semibold text-zinc-400 transition hover:text-white">
          ← Back to event
        </Link>

        <div className="mt-6 rounded-3xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 ring-1 ring-white/10 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <EventStatusBadge status={event.status} verification={event.verification} />
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-zinc-400 ring-1 ring-white/10">
              {event.type}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{event.name}</h1>
          <p className="mt-1.5 text-zinc-300">
            {event.celebrityName} · {weekday}, {date}
            {location ? ` · ${location}` : ""}
          </p>
          {event.status === "UPCOMING" && <EventCountdown startAt={event.startAt} className="mt-3 inline-block" />}
        </div>

        <div className="mt-8">
          <TicketPicker eventId={event.eventId} eventName={event.name} tickets={view.tickets} />
        </div>
      </div>
    </div>
  );
}