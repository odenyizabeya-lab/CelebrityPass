"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Source = {
  id: string;
  name: string;
  key: string;
  kind: string;
  enabled: boolean;
  supportsTickets: boolean;
  hasCredentials: boolean;
  ticketsLastSyncStatus: string | null;
  ticketsLastSyncMessage: string | null;
  nextSync: string | null;
  eventCount: number;
};
type Provider = { key: string; label: string; requiresCredentials: boolean; credentialEnvVars: string[]; hasCredentials: boolean };

export default function AdminTicketSources({ sources, providers }: { sources: Source[]; providers: Provider[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(source: Source) {
    setError(null);
    setBusyId(source.id);
    try {
      const res = await fetch(`/api/tickets/admin/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supportsTickets: !source.supportsTickets }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Could not update the source.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the source.");
    } finally {
      setBusyId(null);
    }
  }

  async function sync(source: Source) {
    setError(null);
    setBusyId(source.id);
    try {
      const res = await fetch(`/api/tickets/admin/sources/${source.id}/sync`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Sync failed.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {error && <p className="mb-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-400/20">{error}</p>}

      <section className="mb-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Registered ticket providers</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Ticket inventory can only come from these authorized providers (never from the manual “admin” source).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <div key={p.key} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-white">{p.label}</p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                    p.hasCredentials ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" : "bg-white/5 text-zinc-400 ring-white/10"
                  }`}
                >
                  {p.key}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{p.credentialEnvVars.join(", ") || "no env vars"}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {p.hasCredentials ? (
                  <span className="text-emerald-300">Credentials present</span>
                ) : (
                  <span className="text-zinc-500">{p.requiresCredentials ? "Needs credentials to fetch real data" : "Works unconfigured (returns honest empty results)"}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </section>

      <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Event sources &amp; ticket sync</h2>
      <div className="mt-3 space-y-3">
        {sources.map((s) => {
          const placeholderProvider = providers.find((p) => p.key === s.key);
          const canBeTicketSource = s.key !== "admin";
          return (
            <div key={s.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{s.name}</p>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-400 ring-1 ring-white/10">{s.kind} · {s.key}</span>
                    {s.enabled ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-400/30">enabled</span>
                    ) : (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-400 ring-1 ring-white/10">disabled</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{s.eventCount} events · next sync {s.nextSync ?? "now/never"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => sync(s)}
                    disabled={!s.enabled || !s.supportsTickets || busyId === s.id}
                    className="rounded-full px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busyId === s.id ? "Syncing…" : "Sync now"}
                  </button>
                  {canBeTicketSource && (
                    <button
                      onClick={() => toggle(s)}
                      disabled={busyId === s.id}
                      className={`rounded-full px-4 py-2 text-xs font-bold ring-1 transition disabled:opacity-40 ${
                        s.supportsTickets ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30 hover:bg-emerald-500/25" : "bg-white/5 text-zinc-400 ring-white/15 hover:bg-white/10"
                      }`}
                    >
                      {s.supportsTickets ? "Ticket sync ON" : "Ticket sync OFF"} {placeholderProvider && !placeholderProvider.hasCredentials ? "· unconfigured" : ""}
                    </button>
                  )}
                </div>
              </div>

              {s.supportsTickets && (
                <div className="mt-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
                  <p className="text-xs text-zinc-400">
                    Last ticket sync:{" "}
                    {s.ticketsLastSyncStatus ? (
                      <span className={s.ticketsLastSyncStatus === "success" ? "font-semibold text-emerald-300" : s.ticketsLastSyncStatus === "error" ? "font-semibold text-rose-300" : "font-semibold text-amber-300"}>
                        {s.ticketsLastSyncStatus}
                      </span>
                    ) : (
                      "never"
                    )}
                    {s.ticketsLastSyncMessage ? ` — ${s.ticketsLastSyncMessage}` : ""}
                  </p>
                </div>
              )}
            </div>
          );
        })}
        {sources.length === 0 && (
          <p className="rounded-2xl bg-zinc-800/40 px-5 py-6 text-sm text-zinc-400 ring-1 ring-white/10">No event sources configured yet.</p>
        )}
      </div>
    </div>
  );
}