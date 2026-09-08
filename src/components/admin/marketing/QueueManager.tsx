"use client";

import { useCallback, useEffect, useState } from "react";
import { api, EmptyState, fmtDate, PlatformMark, SourceBadge, StatusBadge } from "./SocialUI";

interface QueueItem {
  id: string;
  contentKey: string;
  platformKey: string;
  platformName: string;
  platformColor: string;
  accountUsername: string | null;
  contentType: string;
  contentRefId: string | null;
  title: string;
  caption: string | null;
  linkUrl: string | null;
  source: string;
  status: string;
  scheduledFor: Date | null;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date | null;
  lastError: string | null;
  externalUrl: string | null;
  publishedAt: Date | null;
  createdAt: Date;
}

const STATUS_FILTERS = ["PENDING", "SCHEDULED", "APPROVAL_REQUIRED", "DRAFT", "FAILED", "CANCELLED"] as const;

export default function QueueManager() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const status = filter === "PENDING" ? "QUEUED,SCHEDULED" : filter;
      const d = await api<{ items: QueueItem[] }>(`/api/social/admin/queue?status=${encodeURIComponent(status)}&limit=150`);
      setItems(d.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load queue");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const act = async (id: string, action: string) => {
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/social/admin/queue/${id}`, { method: "POST", body: JSON.stringify({ action }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this queue item permanently?")) return;
    setBusyId(id);
    setError(null);
    await fetch(`/api/social/admin/queue/${id}`, { method: "DELETE" }).catch(() => undefined);
    setBusyId(null);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Posting Queue</h1>
          <p className="mt-1 text-sm text-zinc-400">Everything waiting to be posted — automate, approve or cancel from here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                filter === s ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white" : "ring-1 ring-white/10 text-zinc-400 hover:bg-white/5"
              }`}
            >
              {s === "PENDING" ? "Pending" : s.split("_").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">{error}</div>}

      {loading ? (
        <p className="py-16 text-center text-zinc-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="glass rounded-3xl"><EmptyState text="Nothing here." /></div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <PlatformMark name={item.platformName} color={item.platformColor} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-white">{item.title}</h3>
                      <StatusBadge status={item.status} />
                      <SourceBadge source={item.source} />
                    </div>
                    <p className="mt-0.5 text-xs capitalize text-zinc-500">
                      {item.contentType} · {item.platformName} · queued {fmtDate(item.createdAt)}
                    </p>
                    {item.caption && <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm text-zinc-400">{item.caption}</p>}
                    {item.lastError && <p className="mt-1 text-xs text-rose-400">{item.lastError}</p>}
                    {(item.scheduledFor || item.nextAttemptAt) && (
                      <p className="mt-1 text-xs text-zinc-500">
                        {item.status === "SCHEDULED" && item.scheduledFor ? `Scheduled for ${fmtDate(item.scheduledFor)}` : ""}
                        {item.nextAttemptAt ? ` · retry ${fmtDate(item.nextAttemptAt)}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-zinc-500">
                  attempts {item.attempts}/{item.maxAttempts || 3}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
                {item.status === "APPROVAL_REQUIRED" && (
                  <button onClick={() => act(item.id, "approve")} disabled={busyId === item.id} className="btn-grad rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                    Approve &amp; publish
                  </button>
                )}
                {["FAILED", "CANCELLED"].includes(item.status) && (
                  <button onClick={() => act(item.id, "retry")} disabled={busyId === item.id} className="rounded-full border border-indigo-400/40 px-5 py-2 text-sm font-bold text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50">
                    Retry
                  </button>
                )}
                {["QUEUED", "SCHEDULED"].includes(item.status) && (
                  <button onClick={() => act(item.id, "publish")} disabled={busyId === item.id} className="rounded-full border border-emerald-400/40 px-5 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">
                    Publish now
                  </button>
                )}
                {["QUEUED", "SCHEDULED", "DRAFT"].includes(item.status) && (
                  <button onClick={() => act(item.id, "cancel")} disabled={busyId === item.id} className="rounded-full border border-amber-500/30 px-5 py-2 text-sm font-bold text-amber-300 hover:bg-amber-500/10 disabled:opacity-50">
                    Cancel
                  </button>
                )}
                <button onClick={() => remove(item.id)} disabled={busyId === item.id} className="rounded-full border border-rose-500/30 px-5 py-2 text-sm font-bold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}