// Server-side section components for the celebrity profile page events area.
// Renders the four live groupings with honest empty states.
import EventCard from "./EventCard";
import EventStatusBadge from "./EventStatusBadge";
import EmptyState from "@/components/EmptyState";
import type { EventSummary } from "@/lib/events/service";

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-lg ring-1 ring-white/10">{icon}</span>
      <h2 className="text-xl font-black tracking-tight">{title}</h2>
    </div>
  );
}

function LastSync({ lastSyncedAt }: { lastSyncedAt: Date | null }) {
  if (!lastSyncedAt) return null;
  const s = new Date(lastSyncedAt);
  const label = s.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return <span className="text-[11px] text-zinc-500">Last synced {label}</span>;
}

export function EventsUpcoming({ events, accent, lastSyncedAt }: { events: EventSummary[]; accent: string; lastSyncedAt: Date | null }) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeader title="Upcoming Events" icon={<span>📅</span>} />
        <LastSync lastSyncedAt={lastSyncedAt} />
      </div>
      <div className="mt-4 space-y-3">
        {events.length === 0 ? (
          <EmptyState message="No upcoming public events found." />
        ) : (
          events.map((e) => <EventCard key={e.id} event={e} accentColor={accent} />)
        )}
      </div>
    </section>
  );
}

export function EventsHappeningNow({ events }: { events: EventSummary[] }) {
  if (events.length === 0) return null;
  return (
    <section className="rounded-2xl ring-1 ring-rose-500/30 bg-rose-500/5 p-5">
      <SectionHeader title="Happening Now" icon={<span>🔴</span>} />
      <div className="mt-4 space-y-3">
        {events.map((e) => (
          <EventCard key={e.id} event={e} showCountdown={false} />
        ))}
      </div>
    </section>
  );
}

export function EventsCompleted({ events, accent }: { events: EventSummary[]; accent: string }) {
  return (
    <section>
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-lg ring-1 ring-white/10">✓</span>
        <h2 className="text-xl font-black tracking-tight">Completed Events</h2>
      </div>
      <p className="mt-1 text-sm text-zinc-500">Previously completed public events for {events.length ? "this celebrity" : "browsing"}.</p>
      <div className="mt-4 space-y-3">
        {events.length === 0 ? (
          <EmptyState message="No completed public events yet." />
        ) : (
          events.map((e) => <EventCard key={e.id} event={e} accentColor={accent} showCountdown={false} />)
        )}
      </div>
    </section>
  );
}

export function EventsIssueSection({ events }: { events: EventSummary[] }) {
  const all = [...events].sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
  if (all.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-lg ring-1 ring-white/10">⚠️</span>
        <h2 className="text-xl font-black tracking-tight">Postponed &amp; Cancelled</h2>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        These events were publicly announced as postponed or cancelled. They are not happening as originally scheduled.
      </p>
      <div className="mt-4 space-y-3">
        {all.map((e) => (
          <div key={e.id} className="glass flex flex-col gap-3 rounded-2xl p-5 opacity-80 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <EventStatusBadge status={e.status} verification={e.verification} />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{e.type}</span>
              </div>
              <h3 className="mt-2 truncate text-lg font-bold text-white">{e.name}</h3>
              <p className="mt-1 truncate text-sm text-zinc-400">
                {[e.venue, e.city, e.country].filter(Boolean).join(", ") ||
                  new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(e.startAt)}
              </p>
            </div>
            <a
              href={`/celebrity/${e.celebritySlug}/event/${e.eventId}`}
              className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/5"
            >
              Details →
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
