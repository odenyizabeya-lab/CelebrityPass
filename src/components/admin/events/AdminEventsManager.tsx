"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EventStatusBadge, { VerificationPill } from "@/components/events/EventStatusBadge";
import { statusLabel, type EventStatus, type VerificationStatus } from "@/lib/events/types";

type AdminCelebrity = { id: string; name: string; slug: string };
type AdminSource = { id: string; key: string; name: string; lastSyncAt: string | null; lastSyncStatus: string | null };

type AdminEvent = {
  id: string;
  eventId: string;
  celebrityId: string;
  celebritySlug: string;
  celebrityName: string;
  name: string;
  type: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  startAt: string;
  endAt: string | null;
  timezone: string | null;
  allDay: boolean;
  status: EventStatus;
  officialUrl: string | null;
  ticketUrl: string | null;
  sourceUrl: string | null;
  verification: VerificationStatus;
  lastSyncedAt: string | null;
  updatedAt: string;
};

type Filters = { search: string; celebrityId: string; type: string; country: string; status: string; verification: string };

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminEventsManager({
  celebrities,
  sources,
  eventTypes,
  statuses,
  verifications,
}: {
  celebrities: AdminCelebrity[];
  sources: AdminSource[];
  eventTypes: string[];
  statuses: string[];
  verifications: string[];
}) {
  const router = useRouter();
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({ search: "", celebrityId: "", type: "", country: "", status: "", verification: "" });
  const [modal, setModal] = useState<{ open: boolean; event: AdminEvent | null }>({ open: false, event: null });
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = useCallback(async (f: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (f.search) qs.set("search", f.search);
      if (f.celebrityId) qs.set("celebrityId", f.celebrityId);
      if (f.type) qs.set("type", f.type);
      if (f.country) qs.set("country", f.country);
      if (f.status) qs.set("status", f.status);
      if (f.verification) qs.set("verification", f.verification);
      const res = await fetch(`/api/events?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load events");
      setEvents(data.events as AdminEvent[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger the initial load from a module-level flag to avoid setState-in-effect
  // cascades; subscriptions fire setState in callbacks which is allowed.
  useEffect(() => {
    const initialFilters = filters;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) void load(initialFilters);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilter = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    load(next);
  };

  const runSync = async (sourceId?: string) => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/events/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sourceId ? { sourceId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSyncMsg("Sync completed. Refresh event lists to see changes.");
      router.refresh();
    } catch (e) {
      setSyncMsg(e instanceof Error ? `Sync error: ${e.message}` : "Sync error");
    } finally {
      setSyncing(false);
    }
  };

  const openCreate = () => setModal({ open: true, event: null });
  const openEdit = (e: AdminEvent) => setModal({ open: true, event: e });
  const closeModal = () => {
    setModal({ open: false, event: null });
    load(filters);
  };

  const quickVerify = async (e: AdminEvent, v: VerificationStatus) => {
    try {
      await fetch(`/api/events/${e.eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification: v }),
      });
      load(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const quickOverride = async (e: AdminEvent, o: "POSTPONED" | "CANCELLED" | "NONE") => {
    try {
      await fetch(`/api/events/${e.eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: o }),
      });
      load(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const deleteEvent = async (e: AdminEvent) => {
    if (!confirm(`Delete "${e.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/events/${e.eventId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setEvents((prev) => prev.filter((x) => x.id !== e.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const countries = useCallback(() => {
    const set = new Set<string>();
    events.forEach((e) => e.country && set.add(e.country));
    return [...set].sort();
  }, [events]);

  return (
    <div>
      {/* Sync status banner */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Automatic synchronization</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Events are served from the database on every page load. Sync runs in the background against enabled public sources&nbsp;
            (never on page render). Configure real credentials in the Event Sources area.
          </p>
        </div>
        <button
          onClick={() => runSync()}
          disabled={syncing}
          className="rounded-full bg-emerald-500/15 px-5 py-2 text-sm font-bold text-emerald-300 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25 disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Run sync now"}
        </button>
      </div>
      {syncMsg && <p className="mb-4 text-sm text-emerald-300">{syncMsg}</p>}

      {/* Filters */}
      <div className="glass rounded-2xl p-4">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <input
            value={filters.search}
            onChange={(e) => applyFilter({ search: e.target.value })}
            placeholder="Search events…"
            className="rounded-xl border border-white/10 bg-ink-950/50 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-primary-500 focus:outline-none"
          />
          <select value={filters.celebrityId} onChange={(e) => applyFilter({ celebrityId: e.target.value })} className="rounded-xl border border-white/10 bg-ink-950/50 px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">All celebrities</option>
            {celebrities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={filters.type} onChange={(e) => applyFilter({ type: e.target.value })} className="rounded-xl border border-white/10 bg-ink-950/50 px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">All types</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={filters.country} onChange={(e) => applyFilter({ country: e.target.value })} className="rounded-xl border border-white/10 bg-ink-950/50 px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">All countries</option>
            {countries().map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={filters.status} onChange={(e) => applyFilter({ status: e.target.value })} className="rounded-xl border border-white/10 bg-ink-950/50 px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
          <select value={filters.verification} onChange={(e) => applyFilter({ verification: e.target.value })} className="rounded-xl border border-white/10 bg-ink-950/50 px-3 py-2 text-sm text-white focus:outline-none">
            <option value="">All verification</option>
            {verifications.map((v) => (
              <option key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-zinc-500">{loading ? "Loading…" : `${events.length} event(s)`}</span>
          <button
            onClick={openCreate}
            className="rounded-full bg-primary-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-primary-500"
          >
            + Add public event
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

      {/* Event rows */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading events…</p>
        ) : events.length === 0 ? (
          <EmptyStateAdmin message="No events match these filters. No fabricated data is shown — add publicly announced events or run a sync." />
        ) : (
          events.map((e) => (
            <div key={e.id} className="glass flex flex-col gap-3 rounded-2xl p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <EventStatusBadge status={e.status} />
                  <VerificationPill verification={e.verification} />
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 ring-1 ring-white/10">{e.type}</span>
                </div>
                <h3 className="mt-2 truncate text-base font-bold text-white">{e.name}</h3>
                <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400">
                  <span>{e.celebrityName}</span>
                  <span>{new Date(e.startAt).toLocaleString()}</span>
                  <span>{[e.city, e.country].filter(Boolean).join(", ") || "—"}</span>
                </p>
                <p className="mt-1 text-[11px] text-zinc-600">
                  {e.eventId} · {e.lastSyncedAt ? `synced ${new Date(e.lastSyncedAt).toLocaleString()}` : "not synced"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={e.status === "POSTPONED" || e.status === "CANCELLED" ? e.status : ""}
                  onChange={(ev) => quickOverride(e, ev.target.value as "POSTPONED" | "CANCELLED" | "NONE")}
                  className="rounded-full border border-white/10 bg-ink-950/50 px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="">Set status…</option>
                  <option value="POSTPONED">Postponed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="NONE">Clear override</option>
                </select>
                <select
                  value={e.verification === "UNVERIFIED" ? "" : e.verification}
                  onChange={(ev) => quickVerify(e, (ev.target.value || "UNVERIFIED") as VerificationStatus)}
                  className="rounded-full border border-white/10 bg-ink-950/50 px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="">Verify…</option>
                  {verifications.filter((v) => v !== "UNVERIFIED").map((v) => (
                    <option key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</option>
                  ))}
                </select>
                <a href={`/celebrity/${e.celebritySlug}/event/${e.eventId}`} target="_blank" rel="noreferrer" className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-white/15 transition hover:bg-white/5">
                  View ↗
                </a>
                <button onClick={() => openEdit(e)} className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/15 transition hover:bg-white/10">
                  Edit
                </button>
                <button onClick={() => deleteEvent(e)} className="rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-400/30 transition hover:bg-rose-500/20">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Source status */}
      <div className="mt-8">
        <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Data Sources</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s) => (
            <div key={s.id} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">{s.name}</p>
                <span className={`h-2 w-2 rounded-full ${s.lastSyncStatus === "error" ? "bg-rose-400" : s.lastSyncStatus === "ok" ? "bg-emerald-400" : s.lastSyncStatus === "running" ? "bg-amber-400 animate-pulse" : "bg-zinc-600"}`} />
              </div>
              <p className="mt-1 font-mono text-[11px] text-zinc-500">{s.key}</p>
              <p className="mt-2 text-[11px] text-zinc-500">
                {s.lastSyncAt ? `Last sync: ${new Date(s.lastSyncAt).toLocaleString()}` : "Never synced"}
              </p>
              <button
                onClick={() => runSync(s.id)}
                disabled={syncing}
                className="mt-3 rounded-full px-4 py-1.5 text-xs font-semibold ring-1 ring-white/15 transition hover:bg-white/5 disabled:opacity-50"
              >
                Sync this source
              </button>
            </div>
          ))}
          {sources.length === 0 && <p className="text-sm text-zinc-500">No event sources configured yet. Add them in Event Sources.</p>}
        </div>
      </div>

      {modal.open && (
        <EventFormModal
          event={modal.event}
          celebrities={celebrities}
          eventTypes={eventTypes}
          verifications={verifications}
          onClose={closeModal}
          onSaved={() => closeModal()}
        />
      )}
    </div>
  );
}

function EmptyStateAdmin({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">{message}</div>;
}

function EventFormModal({
  event,
  celebrities,
  eventTypes,
  verifications,
  onClose,
  onSaved,
}: {
  event: AdminEvent | null;
  celebrities: AdminCelebrity[];
  eventTypes: string[];
  verifications: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => ({
    name: event?.name ?? "",
    celebrityId: event?.celebrityId ?? (celebrities[0]?.id ?? ""),
    type: event?.type ?? "Concert",
    description: event?.description ?? "",
    venue: event?.venue ?? "",
    city: event?.city ?? "",
    region: event?.region ?? "",
    country: event?.country ?? "",
    startLocal: toLocalInput(event?.startAt ?? null),
    endLocal: toLocalInput(event?.endAt ?? null),
    timezone: event?.timezone ?? "",
    allDay: event?.allDay ?? false,
    officialUrl: event?.officialUrl ?? "",
    ticketUrl: event?.ticketUrl ?? "",
    sourceUrl: event?.sourceUrl ?? "",
    statusOverride: event?.status === "POSTPONED" || event?.status === "CANCELLED" ? event.status : "NONE",
    verification: event?.verification ?? "UNVERIFIED",
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        celebrityId: form.celebrityId,
        name: form.name,
        type: form.type,
        description: form.description || null,
        venue: form.venue || null,
        city: form.city || null,
        region: form.region || null,
        country: form.country || null,
        startAt: form.startLocal ? new Date(form.startLocal).toISOString() : null,
        endAt: form.endLocal ? new Date(form.endLocal).toISOString() : null,
        timezone: form.timezone || null,
        allDay: form.allDay,
        officialUrl: form.officialUrl || null,
        ticketUrl: form.ticketUrl || null,
        sourceUrl: form.sourceUrl || null,
        status: form.statusOverride,
        verification: form.verification,
      };
      const res = await fetch(event ? `/api/events/${event.eventId}` : "/api/events", {
        method: event ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full rounded-xl border border-white/10 bg-ink-950/50 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-primary-500 focus:outline-none";
  const label = "mt-3 block text-[11px] font-black uppercase tracking-widest text-zinc-500";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-3xl bg-ink-900 p-6 shadow-2xl ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight">{event ? "Edit public event" : "Add public event"}</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-zinc-400 transition hover:bg-white/5 hover:text-white">✕</button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Only publicly announced event information. No fabricated data or ticket links.</p>

        <div className="mt-5 max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <label className={label}>Event name *</label>
          <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. 2026 World Tour — Live in Los Angeles" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Celebrity *</label>
              <select className={input} value={form.celebrityId} onChange={(e) => set("celebrityId", e.target.value)}>
                {celebrities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Event type</label>
              <select className={input} value={form.type} onChange={(e) => set("type", e.target.value)}>
                {eventTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <label className={label}>Description</label>
          <textarea className={`${input} min-h-[70px]`} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Public description of the event…" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Venue</label>
              <input className={input} value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Venue name" />
            </div>
            <div>
              <label className={label}>Timezone (IANA)</label>
              <input className={input} value={form.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="e.g. America/New_York" />
            </div>
            <div>
              <label className={label}>City</label>
              <input className={input} value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div>
              <label className={label}>Region / State</label>
              <input className={input} value={form.region} onChange={(e) => set("region", e.target.value)} />
            </div>
            <div>
              <label className={label}>Country</label>
              <input className={input} value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
            <div>
              <label className={label}>All-day</label>
              <label className="mt-2 flex items-center gap-2 text-sm text-white">
                <input type="checkbox" checked={form.allDay} onChange={(e) => set("allDay", e.target.checked)} className="h-4 w-4" />
                All-day event
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Start date &amp; time *</label>
              <input type="datetime-local" className={input} value={form.startLocal} onChange={(e) => set("startLocal", e.target.value)} />
            </div>
            <div>
              <label className={label}>End date &amp; time</label>
              <input type="datetime-local" className={input} value={form.endLocal} onChange={(e) => set("endLocal", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Official event URL</label>
              <input className={input} value={form.officialUrl} onChange={(e) => set("officialUrl", e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <label className={label}>Official ticket URL</label>
              <input className={input} value={form.ticketUrl} onChange={(e) => set("ticketUrl", e.target.value)} placeholder="https://… (official only)" />
            </div>
            <div>
              <label className={label}>Source URL</label>
              <input className={input} value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} placeholder="Original public source" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Status override</label>
                <select className={input} value={form.statusOverride} onChange={(e) => set("statusOverride", e.target.value)}>
                  <option value="NONE">Auto (from date)</option>
                  <option value="POSTPONED">Postponed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div>
                <label className={label}>Verification</label>
                <select className={input} value={form.verification} onChange={(e) => set("verification", e.target.value)}>
                  {verifications.map((v) => (
                    <option key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !form.name || !form.startLocal}
            className="rounded-full bg-primary-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-primary-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : event ? "Save changes" : "Add event"}
          </button>
        </div>
      </div>
    </div>
  );
}
