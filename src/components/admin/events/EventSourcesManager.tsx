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
type ProviderKeyStatus = { label: string; hasKey: boolean; envVar: string };

export default function EventSourcesManager({ sources: initial }: { sources: Source[] }) {
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>(initial);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [providerKeys, setProviderKeys] = useState<Record<string, ProviderKeyStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [sourcesRes, keysRes] = await Promise.all([
      fetch("/api/events/sources"),
      fetch("/api/admin/provider-settings"),
    ]);
    const sourcesData = await sourcesRes.json();
    const keysData = await keysRes.json();
    setSources(sourcesData.sources);
    setProviders(sourcesData.providers);
    setProviderKeys(keysData.providers ?? {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

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

  const saveProviderKey = async (providerKey: string) => {
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/provider-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerKey, key: keyValues[providerKey] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save key");
      setMsg(`API key for ${providerKeys[providerKey]?.label ?? providerKey} saved.`);
      setEditingKey(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save key");
    }
  };

  const testConnection = async (providerKey: string) => {
    setTestingKey(providerKey);
    setError(null);
    setTestResults((prev) => ({ ...prev, [providerKey]: { ok: false, message: "Testing..." } }));
    try {
      const res = await fetch("/api/admin/provider-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerKey }),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [providerKey]: data }));
    } catch (e) {
      setTestResults((prev) => ({ ...prev, [providerKey]: { ok: false, message: e instanceof Error ? e.message : "Test failed" } }));
    } finally {
      setTestingKey(null);
    }
  };

  const hasKey = (key: string) => providerKeys[key]?.hasKey ?? false;

  return (
    <div>
      {error && <div className="mb-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-400/30">{error}</div>}
      {msg && <div className="mb-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 ring-1 ring-emerald-400/30">{msg}</div>}

      {/* Provider API Keys */}
      <div className="mt-2">
        <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Provider API Keys</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Store API keys securely server-side. Keys are never exposed to the browser.
        </p>
        <div className="mt-3 space-y-3">
          {Object.entries(providerKeys).map(([key, config]) => (
            <div key={key} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`grid h-3 w-3 rounded-full ${config.hasKey ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <div>
                    <p className="text-sm font-bold text-white">{config.label}</p>
                    <p className="font-mono text-[11px] text-zinc-500">env: {config.envVar}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingKey === key ? (
                    <>
                      <input
                        type="password"
                        value={keyValues[key] ?? ""}
                        onChange={(e) => setKeyValues((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="Paste API key"
                        className="w-48 rounded-xl border border-white/10 bg-ink-800 px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none transition focus:border-primary-500"
                      />
                      <button
                        onClick={() => saveProviderKey(key)}
                        className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingKey(null); setKeyValues((prev) => ({ ...prev, [key]: "" })); }}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-400 ring-1 ring-white/10 transition hover:text-white"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditingKey(key); setKeyValues((prev) => ({ ...prev, [key]: "" })); }}
                        className="rounded-full bg-primary-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-primary-500"
                      >
                        {config.hasKey ? "Replace" : "Add key"}
                      </button>
                      <button
                        onClick={() => testConnection(key)}
                        disabled={testingKey === key || !config.hasKey}
                        className="rounded-full bg-white/5 px-3.5 py-1.5 text-xs font-bold text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-40"
                      >
                        {testingKey === key ? "Testing..." : "Test"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {testResults[key] && (
                <div className={`mt-2 rounded-xl px-3 py-2 text-xs ring-1 ${testResults[key].ok ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30" : "bg-rose-500/10 text-rose-300 ring-rose-400/30"}`}>
                  {testResults[key].message}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Available providers */}
      <div className="mt-8">
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
                  {p.key === "ticketmaster"
                    ? hasKey("ticketmaster")
                      ? "Key is set — add this source and run a sync to pull real events."
                      : "Needs your free Ticketmaster key — paste it in the API Keys section above."
                    : hasKey(p.key)
                      ? "Key is set — add this source and run a sync."
                      : `Requires API key — paste it in the API Keys section above.`}
                </p>
              )}
              {!p.requiresCredentials && (
                <p className="mt-2 text-[11px] text-emerald-300">
                  Free — no API key required. Add this source to start syncing.
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

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Credential status</p>
                    <p className="mt-1 text-xs text-white">
                      {hasKey(s.key) ? "API key configured" : providers.find((p) => p.key === s.key)?.requiresCredentials ? "API key required" : "No key needed"}
                    </p>
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
          Provider API keys are stored only server-side (admin settings) and are never included in frontend JavaScript.
          The admin panel only shows whether a credential is present, never its value. Until you add a real key, providers
          return empty results and the site shows legitimate empty states — it never fabricates events.
        </p>
      </div>
    </div>
  );
}
