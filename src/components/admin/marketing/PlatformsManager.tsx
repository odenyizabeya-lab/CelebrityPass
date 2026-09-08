"use client";

import { useCallback, useEffect, useState } from "react";
import { api, EmptyState, PlatformMark, StatusBadge } from "./SocialUI";

interface Platform {
  key: string;
  name: string;
  color: string;
  enabled: boolean;
  oauth: boolean;
  authUrl: string;
  requiresApproval: boolean;
  approvalStatus: string;
  approvalNote: string | null;
  hasCredentials: boolean;
  configuredEnv: boolean;
  apiStatus: string;
  apiNote: string | null;
  credentialEnvKeys: string[];
  scopes: string[];
}

export default function PlatformsManager() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ platforms: Platform[] }>("/api/social/admin/platforms");
      setPlatforms(d.platforms);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load platforms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const save = async (key: string, patch: Partial<Platform>) => {
    setSavingKey(key);
    setError(null);
    try {
      await api("/api/social/admin/platforms", { method: "PUT", body: JSON.stringify({ key, ...patch }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Platform Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">Enable/disable platforms, and see which official APIs need keys or developer approval.</p>
      </div>

      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">{error}</div>}

      {loading ? (
        <p className="py-16 text-center text-zinc-500">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {platforms.map((p) => (
            <section key={p.key} className="glass card-hover rounded-3xl p-6">
              <div className="flex items-center gap-4">
                <PlatformMark name={p.name} color={p.color} />
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 text-lg font-black text-white">
                    {p.name}
                    <StatusBadge status={p.enabled ? "QUEUED" : "disconnected"} />
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {p.oauth ? "OAuth 2.0" : "API token"} · {p.requiresApproval ? "developer approval required" : "immediate"}
                  </p>
                </div>
                <button
                  onClick={() => save(p.key, { enabled: !p.enabled })}
                  disabled={savingKey === p.key}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${p.enabled ? "border border-amber-500/40 text-amber-300 hover:bg-amber-500/10" : "btn-grad text-white"}`}
                >
                  {p.enabled ? "Disable" : "Enable"}
                </button>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-ink-950/50 px-3 py-2 ring-1 ring-white/[0.06]">
                  <span className="text-zinc-500">API credentials</span>
                  <StatusBadge status={p.configuredEnv ? "connected" : "disconnected"} />
                </div>
                {!p.configuredEnv && (
                  <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-amber-300">Set {p.credentialEnvKeys.join(", ")} in server env vars.</p>
                )}
                <div className="flex items-center justify-between rounded-xl bg-ink-950/50 px-3 py-2 ring-1 ring-white/[0.06]">
                  <span className="text-zinc-500">API status</span>
                  <StatusBadge status={p.apiStatus === "not_configured" ? "disconnected" : p.apiStatus === "configured" ? "connected" : p.apiStatus} />
                </div>
                {p.apiNote && <p className="text-zinc-500">{p.apiNote}</p>}
                {p.approvalNote && <p className="rounded-xl bg-violet-500/10 px-3 py-2 text-violet-300">{p.approvalNote}</p>}
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Approval workflow status</label>
                <select
                  value={p.approvalStatus}
                  onChange={(e) => save(p.key, { approvalStatus: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-primary-500"
                >
                  <option value="required">Required</option>
                  <option value="not_required">Not required</option>
                  <option value="pending">Pending review</option>
                  <option value="granted">Granted</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
            </section>
          ))}
          {platforms.length === 0 && <div className="md:col-span-2 xl:col-span-3"><div className="glass rounded-3xl"><EmptyState text="No platforms seeded." /></div></div>}
        </div>
      )}
    </div>
  );
}