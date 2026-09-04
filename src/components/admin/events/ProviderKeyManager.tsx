"use client";

import { useCallback, useEffect, useState } from "react";

type ProviderKeyStatus = { label: string; hasKey: boolean; envVar: string };

export default function ProviderKeyManager() {
  const [providers, setProviders] = useState<Record<string, ProviderKeyStatus>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/provider-settings");
      const data = await res.json();
      setProviders(data.providers ?? {});
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const saveKey = async (providerKey: string) => {
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
      setMsg(`API key for ${providers[providerKey]?.label ?? providerKey} saved.`);
      setEditingKey(null);
      setKeyValues((prev) => ({ ...prev, [providerKey]: "" }));
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

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-black text-white">Provider API Keys</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Store API keys securely server-side. Keys are never exposed to the browser or Android app.
      </p>

      {error && <div className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-400/30">{error}</div>}
      {msg && <div className="mt-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 ring-1 ring-emerald-400/30">{msg}</div>}

      <div className="mt-4 space-y-3">
        {Object.entries(providers).map(([key, config]) => (
          <div key={key} className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
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
                      placeholder="Paste API key here"
                      className="w-56 rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none transition focus:border-primary-500"
                    />
                    <button
                      onClick={() => saveKey(key)}
                      className="rounded-full bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingKey(null); setKeyValues((prev) => ({ ...prev, [key]: "" })); }}
                      className="rounded-full px-3.5 py-2 text-xs font-semibold text-zinc-400 ring-1 ring-white/10 transition hover:text-white"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditingKey(key); setKeyValues((prev) => ({ ...prev, [key]: "" })); }}
                      className="rounded-full bg-primary-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-500"
                    >
                      {config.hasKey ? "Replace key" : "Add key"}
                    </button>
                    <button
                      onClick={() => testConnection(key)}
                      disabled={testingKey === key || !config.hasKey}
                      className="rounded-full bg-white/5 px-4 py-2 text-xs font-bold text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-40"
                    >
                      {testingKey === key ? "Testing..." : "Test connection"}
                    </button>
                  </>
                )}
              </div>
            </div>
            {testResults[key] && (
              <div className={`mt-3 rounded-xl px-3 py-2 text-xs ring-1 ${testResults[key].ok ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30" : "bg-rose-500/10 text-rose-300 ring-rose-400/30"}`}>
                {testResults[key].message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
