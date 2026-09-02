// Pure helpers for event status derivation, countdown math and formatting.
// Timezone-aware: we compare instants in UTC ("now") against the event's start
// and end instants. The event's IANA timezone is used for human countdown text.

export type ComputedEventStatus = "UPCOMING" | "HAPPENING_NOW" | "COMPLETED" | "POSTPONED" | "CANCELLED";

type StatusInput = {
  statusOverride?: string | null;
  startAt: string | Date | number;
  endAt?: string | Date | number | null;
  now?: Date;
  allDay?: boolean;
};

/**
 * Derive the authoritative event status.
 * - POSTPONED / CANCELLED override always win (publicly announced).
 * - Otherwise derive from the start/end instants vs "now".
 */
export function computeEventStatus(input: StatusInput): ComputedEventStatus {
  if (input.statusOverride === "POSTPONED") return "POSTPONED";
  if (input.statusOverride === "CANCELLED") return "CANCELLED";

  const now = (input.now ?? new Date()).getTime();
  const start = new Date(input.startAt).getTime();
  const end = input.endAt ? new Date(input.endAt).getTime() : null;

  // An all-day event is "happening" on its calendar day (any time that day).
  if (input.allDay) {
    const startDay = new Date(input.startAt).setHours(0, 0, 0, 0);
    const nextDay = new Date(input.startAt).setHours(0, 0, 0, 0) + 86400000;
    if (now >= startDay && now < nextDay) return "HAPPENING_NOW";
    return now < startDay ? "UPCOMING" : "COMPLETED";
  }

  if (now < start) return "UPCOMING";
  // Before end (if known) => happening; without an end, assume it lasts a
  // reasonable window so "Happening Now" isn't shown forever (3 hours default).
  const windowEnd = end != null ? end : start + 3 * 3600 * 1000;
  if (now < windowEnd) return "HAPPENING_NOW";
  return "COMPLETED";
}

/**
 * Countdown breakdown to the event start, in whole units. Returns null when the
 * event has started (or is not upcoming).
 */
export function countdownTo(starAt: string | Date | number, now?: Date) {
  const target = new Date(starAt).getTime();
  const diff = target - (now ?? new Date()).getTime();
  if (diff <= 0) return null;
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, totalMs: diff };
}

/** Human countdown label, e.g. "Starts in 12 days" or "Starts in 04:32:18". */
export function countdownLabel(starAt: string | Date | number, now?: Date): string | null {
  const c = countdownTo(starAt, now);
  if (!c) return null;
  if (c.days >= 1) {
    const d = c.days === 1 ? "1 day" : `${c.days} days`;
    const h = c.hours > 0 ? `, ${c.hours} hr` : "";
    return `Starts in ${d}${h}`;
  }
  const hh = String(c.hours).padStart(2, "0");
  const mm = String(c.minutes).padStart(2, "0");
  const ss = String(c.seconds).padStart(2, "0");
  return `Starts in ${hh}:${mm}:${ss}`;
}

function zeroPad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

/** Compact date like "Mar 12" and weekday "Thursday". */
export function formatEventDate(iso: string | Date, tz?: string | null): { date: string; weekday: string; time: string } {
  const d = new Date(iso);
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz || undefined, ...opts });
  const dateStr = fmt({ month: "short", day: "numeric", year: "numeric" }).format(d);
  const weekday = fmt({ weekday: "long" }).format(d);
  const timeStr = fmt({ hour: "numeric", minute: "2-digit" }).format(d);
  return { date: dateStr, weekday, time: timeStr };
}

/** Full date-time label for an event details page. */
export function formatEventFull(iso: string | Date, tz?: string | null): string {
  const d = new Date(iso);
  const o = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || undefined,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return o.format(d);
}

/** Time-only label (e.g. "6:30 PM") in the event's timezone. */
export function formatEventTime(iso: string | Date, tz?: string | null): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", { timeZone: tz || undefined, hour: "numeric", minute: "2-digit" }).format(d);
}

/** IANA timezone hint label (friendly), e.g. "America/New_York". */
export function friendlyTimezone(tz?: string | null): string | null {
  if (!tz) return null;
  // Try to show an abbreviation via Intl; fall back to the raw name.
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date());
    const abbr = parts.find((p) => p.type === "timeZoneName")?.value;
    return abbr && abbr !== tz ? `${tz} (${abbr})` : tz;
  } catch {
    return tz;
  }
}

/**
 * Build an .ics download for "Add to Calendar". RFC 5545, always UTC-based.
 * Returns the .ics file content as a string (Blob is created client-side).
 */
export function eventIcs(params: {
  name: string;
  description?: string | null;
  location?: string | null;
  startAt: string | Date;
  endAt?: string | Date | null;
  url?: string | null;
}): string {
  const fmtUtc = (d: string | Date) => {
    const dt = new Date(d);
    return `${dt.getUTCFullYear()}${zeroPad(dt.getUTCMonth() + 1)}${zeroPad(dt.getUTCDate())}T${zeroPad(
      dt.getUTCHours(),
    )}${zeroPad(dt.getUTCMinutes())}${zeroPad(dt.getUTCSeconds())}Z`;
  };
  const start = fmtUtc(params.startAt);
  const end = params.endAt ? fmtUtc(params.endAt) : undefined;
  const dtend = end ? `DTEND:${end}\r\n` : "";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FanVerse//Events//EN",
    "BEGIN:VEVENT",
    `UID:${start}-${params.name.replace(/\s+/g, "-")}`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART:${start}`,
    dtend,
    `SUMMARY:${params.name}`,
    params.description ? `DESCRIPTION:${params.description.replace(/\r?\n/g, " ")}` : "",
    params.location ? `LOCATION:${params.location}` : "",
    params.url ? `URL:${params.url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter((l) => l !== "")
    .join("\r\n");
  return lines;
}

/** Generate a unique internal event id, e.g. evt_<cuid-ish>. */
export function newEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
