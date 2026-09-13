import { prisma } from "@/lib/db";

/**
 * Live context for the AI reply assistant.
 *
 * Two kinds of "now" knowledge, gathered fresh per reply so the celebrity's AI
 * answers fans as if it actually knows what is going on right now:
 *
 *   1. SCHEDULE — the platform's own verified CelebrityEvent records (what a
 *      fan would find on the celebrity's event page): what is happening right
 *      now, what is coming next, and the most recent completed event.
 *   2. IMAGE — when a fan sends a photo, the assistant needs to SEE it (the
 *      model accepts image parts). We download the stored chat attachment and
 *      hand it to Gemini as base64 inline_data.
 */

export type LiveSchedule = {
  now: string;
  happeningNow: Presentation[] | null;
  upcoming: Presentation[] | null;
  lastCompleted: Presentation[] | null;
};

type Presentation = {
  name: string;
  kind: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  startAt: string;
  endAt: string | null;
  timezone: string | null;
  url: string | null;
};

const CANCELLED = new Set(["POSTPONED", "CANCELLED"]);

function fmt(d: Date, tz?: string | null): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz || "UTC",
  }).format(d);
}

function toPresentation(e: {
  name: string;
  type: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  startAt: Date;
  endAt: Date | null;
  timezone: string | null;
  officialUrl: string | null;
}): Presentation {
  return {
    name: e.name,
    kind: e.type,
    venue: e.venue,
    city: e.city,
    country: e.country,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt?.toISOString() ?? null,
    timezone: e.timezone,
    url: e.officialUrl,
  };
}

/**
 * Pull the celebrity's live schedule from the platform's own event records.
 * Returns null when there are no events at all (so the caller can decide how to
 * describe "has no official events" vs "we don't know").
 */
export async function getLiveSchedule(celebrityId: string): Promise<LiveSchedule | null> {
  try {
    const now = new Date();
    const rows = await prisma.celebrityEvent.findMany({
      where: { celebrityId },
      orderBy: { startAt: "asc" },
      select: {
        name: true,
        type: true,
        venue: true,
        city: true,
        country: true,
        startAt: true,
        endAt: true,
        timezone: true,
        officialUrl: true,
        status: true,
        statusOverride: true,
      },
    });

    const live = rows.filter(
      (e) =>
        !CANCELLED.has(e.statusOverride ?? "") &&
        (e.status === "HAPPENING_NOW" || (e.startAt <= now && (!e.endAt || e.endAt >= now))),
    );
    const upcoming = rows.filter(
      (e) =>
        !CANCELLED.has(e.statusOverride ?? "") &&
        e.status === "UPCOMING" &&
        e.startAt > now,
    );
    const completed = rows
      .filter(
        (e) =>
          !CANCELLED.has(e.statusOverride ?? "") &&
          e.status === "COMPLETED" &&
          e.endAt != null &&
          e.endAt <= now,
      )
      .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());

    if (!rows.length) return null;

    return {
      now: now.toISOString(),
      happeningNow: live.slice(0, 2).map(toPresentation),
      upcoming: upcoming.slice(0, 4).map(toPresentation),
      lastCompleted: completed.slice(0, 1).map(toPresentation),
    };
  } catch {
    return null;
  }
}

/** Build the human-readable "right now" block for the system prompt. */
export function describeSchedule(s: LiveSchedule | null, name: string): string {
  const lines: string[] = [];
  if (!s) {
    lines.push(
      `No official events are listed for ${name} on the platform right now. Treat that as "nothing publicly scheduled appears on the official event page" — never invent a show, tour or appearance.`,
    );
    lines.push(`Current UTC time: ${new Date().toISOString()}.`);
    return lines.join("\n");
  }

  if (s.happeningNow?.length) {
    lines.push(
      s.happeningNow.map((e) => `RIGHT NOW — HAPPENING: ${e.name} (${e.kind})@${[e.city, e.country].filter(Boolean).join(", ") || "a venue"}. Started ${fmt(new Date(e.startAt), e.timezone)}.`).join("\n"),
    );
  }
  if (s.upcoming?.length) {
    lines.push(
      `Upcoming public events (from the official event page): ${s.upcoming
        .map(
          (e) =>
            `${e.name} (${e.kind}) — ${fmt(new Date(e.startAt), e.timezone)} at ${[e.venue, e.city].filter(Boolean).join(", ") || "a venue"}`,
        )
        .join("; ")}.`,
    );
  }
  if (s.lastCompleted?.length) {
    const e = s.lastCompleted[0];
    lines.push(
      `Most recent public event: ${e.name} (${e.kind}) — ${fmt(new Date(e.startAt), e.timezone)}${e.city ? ` in ${e.city}` : ""}.`,
    );
  }
  lines.push(
    `Current UTC time: ${s.now}. Only use these platform records plus live web search results for anything about where the celebrity is, what they're doing, or what's coming next.`,
  );
  return lines.join("\n");
}

/**
 * Download a fan chat attachment so Gemini can see it. Returns base64 inline
 * image data, or null when the message isn't an image or the image can't be
 * fetched. Keep images small enough for the model (few MB).
 */
export async function resolveFanImage(attachmentJson: string | null | undefined): Promise<{ mime: string; data: string } | null> {
  if (!attachmentJson) return null;
  let att: { url?: string; mime?: string } | null = null;
  try {
    att = JSON.parse(attachmentJson);
  } catch {
    return null;
  }
  const url = att?.url;
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const mime = /^image\//i.test(att?.mime ?? "") ? att!.mime! : "image/jpeg";

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8 * 1024 * 1024) return null;
    return { mime, data: buf.toString("base64") };
  } catch {
    return null;
  }
}