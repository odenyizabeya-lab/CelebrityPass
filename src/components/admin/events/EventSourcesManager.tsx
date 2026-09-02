"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ProviderInfo = { key: string; label: string; requiresCredentials: boolean; credentialEnvVars: string[] };
type Source = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  kind: string;
  baseUrl: string | null;
  envKey: string | null;
  hasCredentials: boolean;
  description: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  _count?: { events: number };
};

export default function EventSourcesManager({ sources: initial }: { sources: Source[] }) {
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>(initial);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/events/sources");
    const data = await res.json();
    setSources(data.sources);
    setProviders(data.providers);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (s: Source) => {
    setError(null);
    try {
      const res = await fetch(`/api/events/sources/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !s.enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setSources((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: data.source.enabled } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const addProvider = async (p: ProviderInfo) => {
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/events/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerKey: p.key, name: p.label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add source");
      setMsg(`Source "${p.label}" added.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add source");
    }
  };

  const runSync = async (s: Source) => {
    setSyncingId(s.id);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/events/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: s.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setMsg(`Sync done for "${s.name}".`);
      router.refresh();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div>
      {error && <div className="mb-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-400/30">{error}</div>}
      {msg && <div className="mb-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 ring-1 ring-emerald-400/30">{msg}</div>}

      {/* Available providers */}
      <div className="mt-2">
        <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Available providers</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {providers.map((p) => (
            <div key={p.key} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-white">{p.label}</p>
                {sources.some((s) => s.key === p.key) ? (
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-zinc-400 ring-1 ring-white/10">Added</span>
                ) : (
                  <button
                    onClick={() => addProvider(p)}
                    className="rounded-full bg-primary-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-primary-500"
                  >
                    Add source
                  </button>
                )}
              </div>
              <p className="mt-1 font-mono text-[11px] text-zinc-500">{p.key}</p>
              {p.requiresCredentials && (
                <p className="mt-2 text-[11px] text-amber-300">
                  Requires credential env var: {p.credentialEnvVars.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Configured sources */}
      <div className="mt-8">
        <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Configured sources</h2>
        {sources.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No sources configured. Add one from above.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {sources.map((s) => (
              <div key={s.id} className="glass rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{s.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700 text-zinc-400"}`}>
                        {s.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                      {s.key} · {s.kind} · {s._count?.events ?? 0} linked event(s)
                    </p>
                    {s.baseUrl && <p className="mt-0.5 truncate text-[11px] text-zinc-600">{s.baseUrl}</p>}
                  </div>
                  <button
                    onClick={() => toggle(s)}
                    disabled={syncingId === s.id}
                    className={`rounded-full px-4 py-2 text-xs font-bold ring-1 transition disabled:opacity-50 ${
                      s.enabled ? "text-zinc-400 ring-white/15 hover:bg-white/5" : "text-emerald-300 ring-emerald-400/30 hover:bg-emerald-500/10"
                    }`}
                  >
                    {s.enabled ? "Disable" : "Enable"}
                  </button>
                </div>

                {/* Credential status — never shows the secret itself. */}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Credential status</p>
                    <p className="mt-1 text-xs text-white">
                      {providers.find((p) => p.key === s.key)?.requiresCredentials
                        ? "Required"
                        : s.hasCredentials
                          ? "Detected in environment"
                          : "None configured"}
                    </p>
                    {s.envKey && (
                      <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                        env: {s.envKey} {s.hasCredentials ? "· set" : "· not set (add on the server)"}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Last sync</p>
                    <p className="mt-1 text-xs text-white">
                      {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : "Never"} {s.lastSyncStatus ? `· ${s.lastSyncStatus}` : ""}
                    </p>
                    {s.lastSyncMessage && <p className="mt-0.5 line-clamp-2 text-[10px] text-zinc-500">{s.lastSyncMessage}</p>}
                  </div>
                </div>

                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => runSync(s)}
                    disabled={syncingId === s.id || !s.enabled}
                    className="rounded-full bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25 disabled:opacity-40"
                  >
                    {syncingId === s.id ? "Syncing…" : "Run sync"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5">
        <h3 className="text-sm font-black text-amber-300">Security: no fake or exposed secrets</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          Provider API keys live only in backend environment variables (e.g. <code className="text-amber-200">EVENT_TICKETING_API_KEY</code>).
          They are never stored in this database and never included in frontend JavaScript. The admin panel only shows whether a credential is
          present, not its value. Until you add real credentials, providers return empty results and the site shows legitimate empty states — it
          never fabricates events.
        </p>
      </div>
    </div>
  );
}
