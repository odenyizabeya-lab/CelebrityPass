"use client";

import { useEffect, useState, useCallback } from "react";
import AnnouncementComposer from "./AnnouncementComposer";

type Stats = {
  totalFans: number;
  unsubscribedFans: number;
  verifiedFans: number;
  emailCounts: Record<string, number> & { total: number; sentLast24h: number };
  recent: Array<{ id: string; to: string; type: string; status: string; attempts: number; subject: string; lastError: string | null; createdAt: string; sentAt: string | null }>;
  announcements: Array<{ id: string; title: string; audienceType: string; template: string; status: string; subject: string; targetsCount: number; enqueuedCount: number; sentCount: number; failedCount: number; createdAt: string }>;
  provider: { configuredFrom: string; configured: boolean; domains: Array<{ id: string; name: string; status: string; records: Array<{ type: string; name: string; value: string; status: string }> }> };
  countries: string[];
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-zinc-500/20 text-zinc-300",
  SENDING: "bg-sky-500/20 text-sky-300",
  SENT: "bg-primary-500/20 text-primary-300",
  DELIVERED: "bg-emerald-500/20 text-emerald-300",
  OPENED: "bg-emerald-500/25 text-emerald-200",
  FAILED: "bg-amber-500/20 text-amber-300",
  PERMANENT_FAILED: "bg-rose-500/20 text-rose-300",
  CANCELED: "bg-zinc-500/10 text-zinc-500",
};

export default function EmailCenter() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/emails/stats");
    if (res.ok) setStats(await res.json());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/emails/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setStats(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const processNow = async () => {
    setProcessing(true);
    setNotice(null);
    const res = await fetch("/api/admin/emails/process", { method: "POST" });
    const data = await res.json();
    setProcessing(false);
    if (res.ok) setNotice(`Queue processed — sent ${data.sent}, failed ${data.failed}.`);
    await refresh();
  };

  if (!stats) {
    return <div className="glass rounded-3xl p-8 text-sm text-zinc-400">Loading Email Center…</div>;
  }

  const c = stats.emailCounts;

  const tiles = [
    { label: "Registered fans", value: stats.totalFans.toLocaleString(), to: undefined },
    { label: "Unsubscribed fans", value: stats.unsubscribedFans.toLocaleString(), to: undefined },
    { label: "Emails sent", value: c.sent.toLocaleString(), to: undefined },
    { label: "Emails delivered", value: c.delivered.toLocaleString(), to: undefined },
    { label: "Pending (queued)", value: (c.PENDING + c.FAILED).toLocaleString(), to: undefined },
    { label: "Failed / stopped", value: (c.PERMANENT_FAILED + (c.FAILED)).toLocaleString(), to: undefined },
  ];

  const domainReady = stats.provider.domains.some((d) => d.status === "verified");

  return (
    <div className="space-y-6">
      {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div>}

      {/* Provider + delivery status */}
      <div className="glass rounded-3xl p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Sending service</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">Email Center</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 text-xs ${stats.provider.configured ? "" : ""}`}>
              <span className={`h-2 w-2 rounded-full ${stats.provider.configured ? "bg-emerald-400" : "bg-rose-400"}`} />
              <span className="text-zinc-300">
                {stats.provider.configured ? `Connected · ${stats.provider.configuredFrom}` : "No API key yet — add one under Notifications"}
              </span>
            </span>
            <button
              type="button"
              onClick={processNow}
              disabled={processing}
              className="rounded-full border border-primary-500/40 px-5 py-2 text-xs font-bold text-primary-300 transition hover:bg-primary-500/10 disabled:opacity-60"
            >
              {processing ? "Processing…" : "Process queue now"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-xs">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${domainReady ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
            {domainReady ? "Sending domain verified (SPF · DKIM)" : "Verify sending domain (SPF/DKIM/DMARC needed for production)"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-zinc-400">
            Queue retries each message up to 3 times · duplicates prevented per event
          </span>
        </div>

        {stats.provider.domains.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {stats.provider.domains.map((d) => (
              <div key={d.id} className="rounded-2xl border border-white/10 bg-ink-800/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">{d.name}</p>
                  <span className={`text-xs font-semibold ${d.status === "verified" ? "text-emerald-300" : "text-amber-300"}`}>{d.status}</span>
                </div>
                {d.records.length > 0 && (
                  <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
                    {d.records.map((r) => (
                      <li key={r.type + r.name}>
                        <span className="font-mono text-zinc-400">{r.type}</span> · {r.name} · {r.value.slice(0, 60)}
                        {r.value.length > 60 ? "…" : ""} · {r.status}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="glass rounded-2xl px-4 py-5">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">{t.label}</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-white">{t.value}</p>
          </div>
        ))}
      </div>

      {/* Compose */}
      <AnnouncementComposer countries={stats.countries} onSent={() => refresh()} />

      {/* Announcements */}
      <div className="glass rounded-3xl p-7">
        <h3 className="text-lg font-bold text-white">Announcements</h3>
        {stats.announcements.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No announcements yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {stats.announcements.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-ink-800/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-200">{a.subject}</p>
                  <p className="text-xs text-zinc-500">
                    {a.audienceType} · targets {a.targetsCount} · enqueued {a.enqueuedCount} · sent {a.sentCount} · failed {a.failedCount}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${STATUS_STYLE[a.status] ?? "bg-zinc-500/20 text-zinc-300"}`}>{a.status}</span>
                  {a.status === "SENDING" && (
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/admin/emails/announcements/${a.id}`, { method: "DELETE" });
                        refresh();
                      }}
                      className="rounded-full border border-rose-500/30 px-3 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-500/10"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="glass rounded-3xl p-7">
        <h3 className="text-lg font-bold text-white">Recent email activity</h3>
        {stats.recent.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No emails yet. They appear here as soon as fans register, load fan cards or buy memberships.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-zinc-500">
                  <th className="py-2 pr-4 font-semibold">To</th>
                  <th className="py-2 pr-4 font-semibold">Type</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 pr-4 font-semibold">Attempts</th>
                  <th className="py-2 pr-4 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((m) => (
                  <tr key={m.id} className="border-b border-white/5">
                    <td className="max-w-[220px] truncate py-2 pr-4 text-zinc-300">{m.to}</td>
                    <td className="py-2 pr-4 text-zinc-400">{m.type.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[m.status] ?? "bg-zinc-500/20 text-zinc-300"}`}>{m.status}</span>
                    </td>
                    <td className="py-2 pr-4 text-zinc-400">{m.attempts}</td>
                    <td className="py-2 pr-4 text-xs text-zinc-500">{new Date(m.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}