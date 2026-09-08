"use client";

/** Shared presentational helpers for the social media admin UI. */

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PUBLISHED: "bg-emerald-500/15 text-emerald-300",
    QUEUED: "bg-sky-500/15 text-sky-300",
    SCHEDULED: "bg-indigo-500/15 text-indigo-300",
    PROCESSING: "bg-amber-500/15 text-amber-300",
    APPROVAL_REQUIRED: "bg-violet-500/15 text-violet-300",
    DRAFT: "bg-zinc-500/15 text-zinc-300",
    FAILED: "bg-rose-500/15 text-rose-300",
    CANCELLED: "bg-zinc-500/15 text-zinc-400",
    SKIPPED: "bg-zinc-500/15 text-zinc-400",
    DELETED: "bg-zinc-500/15 text-zinc-400",
    connected: "bg-emerald-500/15 text-emerald-300",
    revoked: "bg-rose-500/15 text-rose-300",
    invalid: "bg-rose-500/15 text-rose-300",
    expired: "bg-amber-500/15 text-amber-300",
    needs_refresh: "bg-amber-500/15 text-amber-300",
    disconnected: "bg-zinc-500/15 text-zinc-400",
  };
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${map[status] ?? "bg-zinc-500/15 text-zinc-300"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function LevelBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    success: "bg-emerald-500/15 text-emerald-300",
    info: "bg-sky-500/15 text-sky-300",
    warn: "bg-amber-500/15 text-amber-300",
    error: "bg-rose-500/15 text-rose-300",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${map[level] ?? map.info}`}>{level.toUpperCase()}</span>;
}

export function SourceBadge({ source }: { source: string }) {
  const map: Record<string, string> = {
    AUTO: "bg-fuchsia-500/15 text-fuchsia-300",
    MANUAL: "bg-emerald-500/15 text-emerald-300",
    PROMO: "bg-amber-500/15 text-amber-300",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${map[source] ?? "bg-zinc-500/15 text-zinc-300"}`}>{source}</span>;
}

/** Small platform glyph (colored dot + first letters). */
export function PlatformMark({ name, color }: { name: string; color?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black text-white"
      style={{ background: color || "#8b5cf6", boxShadow: `0 0 0 1px ${color || "#8b5cf6"}33` }}
    >
      {initials}
    </span>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p> : null}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="px-5 py-10 text-center text-sm text-zinc-500">{text}</p>;
}

export function fmtDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(value: string | Date | null | undefined) {
  if (!value) return "—";
  const then = new Date(value).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...(init.headers ?? {}) } : init?.headers,
  });
  const data: Record<string, unknown> = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
  return data as T;
}

export function CopyUrl({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-zinc-600">—</span>;
  return (
    <a href={value} target="_blank" rel="noreferrer" className="text-sm text-primary-400 underline decoration-primary-400/40 underline-offset-2 hover:text-primary-300">
      view ↗
    </a>
  );
}