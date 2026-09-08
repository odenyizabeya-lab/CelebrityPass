"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, LevelBadge, PlatformMark, StatusBadge, timeAgo, api } from "./SocialUI";

interface LogEntry {
  id: string;
  platformKey: string;
  platformName: string;
  platformColor: string;
  level: string;
  message: string;
  detail: string | null;
  status: string | null;
  createdAt: Date;
  queueItemId: string | null;
}

export default function LogsList() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState("");

  const load = useCallback(async () => {
    try {
      const qs = level ? `?level=${encodeURIComponent(level)}` : "";
      const d = await api<{ logs: LogEntry[] }>(`/api/social/admin/logs${qs}`);
      setLogs(d.logs);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [level]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const levels = ["success", "info", "warn", "error"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Activity Log</h1>
          <p className="mt-1 text-sm text-zinc-400">Read-only trail of every automation, connection and publish event. Tokens are never logged.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setLevel("")} className={`rounded-full px-4 py-2 text-sm font-bold ${!level ? "bg-violet-600 text-white" : "ring-1 ring-white/10 text-zinc-400"}`}>
            All
          </button>
          {levels.map((l) => (
            <button key={l} onClick={() => setLevel(l)} className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${level === l ? "bg-violet-600 text-white" : "ring-1 ring-white/10 text-zinc-400"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-zinc-500">Loading…</p>
      ) : logs.length === 0 ? (
        <div className="glass rounded-3xl"><EmptyState text="No log entries yet." /></div>
      ) : (
        <ul className="glass overflow-hidden rounded-3xl">
          {logs.map((l, i) => (
            <li key={l.id} className={`flex flex-wrap items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-white/[0.06]" : ""}`}>
              <PlatformMark name={l.platformName} color={l.platformColor} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">{l.message}</p>
                {l.detail && <p className="mt-0.5 break-words text-xs text-zinc-500">{l.detail}</p>}
              </div>
              <div className="flex items-center gap-3">
                <LevelBadge level={l.level} />
                {l.status && <StatusBadge status={l.status} />}
                <span className="w-24 text-right text-xs text-zinc-500">{timeAgo(l.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}