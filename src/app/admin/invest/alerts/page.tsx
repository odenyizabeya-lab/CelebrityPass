"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Alert = {
  id: string;
  level: string;
  ruleKey: string;
  message: string;
  status: string;
  createdAt: string;
  investorNumber: string | null;
  investorEmail: string | null;
};

export default function AdminInvestAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/invest/alerts?open=1")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((d) => setAlerts(d.alerts))
      .catch(() => setError("Could not load alerts."));
  }
  useEffect(load, []);

  async function resolve(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invest/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolve: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Resolve failed.");
        return;
      }
      load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  const levelColor: Record<string, string> = {
    HIGH: "bg-rose-500/15 text-rose-400",
    MEDIUM: "bg-amber-500/15 text-amber-400",
    LOW: "bg-zinc-800 text-zinc-300",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-white">Compliance alerts</h1>
        <Link href="/admin/invest" className="text-sm text-zinc-400 hover:text-white">← Investor overview</Link>
      </div>
      {error && <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-400">{error}</p>}
      <p className="text-sm text-zinc-400">A flag is a prompt for review, never an accusation. Open alerts must be actioned by a human.</p>

      <div className="space-y-3">
        {alerts.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${levelColor[a.level] ?? "bg-zinc-800 text-zinc-300"}`}>{a.level}</span>
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-300">{a.ruleKey}</span>
                <span className="text-xs text-zinc-500">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-300">{a.message}</p>
              {a.investorNumber && <p className="mt-1 text-xs text-zinc-500">{a.investorNumber} · {a.investorEmail}</p>}
            </div>
            <button disabled={busy === a.id} onClick={() => resolve(a.id)} className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-800 disabled:opacity-50">
              {busy === a.id ? "Resolving…" : "Resolve"}
            </button>
          </div>
        ))}
        {alerts.length === 0 && (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-zinc-500">No open alerts.</div>
        )}
      </div>
    </div>
  );
}