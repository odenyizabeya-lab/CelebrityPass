"use client";

import { useCallback, useEffect, useState } from "react";
import { api, EmptyState, StatusBadge } from "./SocialUI";

interface Config {
  automationEnabled: boolean;
  paused: boolean;
  approvalMode: "auto" | "approval";
  maxPostsPerDay: number;
  maxRetries: number;
  retryBackoffMinutes: number;
  dedupeWindowDays: number;
  contentTypes: string[];
}

interface ContentList {
  celebrities: { id: string; name: string; image: string | null; autoPost: boolean; label: string }[];
  memberships: { id: string; name: string; autoPost: boolean; label: string }[];
  events: { id: string; name: string; autoPost: boolean; label: string; when: string | null }[];
  articles: { id: string; name: string; autoPost: boolean; label: string; status: string }[];
}

const CONTENT_TYPES = ["celebrity", "membership", "event", "article", "promo"];

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${on ? "bg-emerald-500" : "bg-zinc-700"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function AutomaticManager() {
  const [config, setConfig] = useState<Config | null>(null);
  const [content, setContent] = useState<ContentList | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([
        api<Config>("/api/social/admin/config"),
        api<ContentList>("/api/social/admin/content"),
      ]);
      setConfig(c);
      setContent(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const save = async (patch: Partial<Config>) => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const next = { ...config, ...patch } as Config;
      await api("/api/social/admin/config", { method: "PUT", body: JSON.stringify(next) });
      setConfig(next);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleEligibility = async (entity: string, id: string, enabled: boolean) => {
    setError(null);
    try {
      await api("/api/social/admin/content/toggle", {
        method: "POST",
        body: JSON.stringify({ entity, id, enabled }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  const toggleContentScope = async (type: string) => {
    if (!config) return;
    const next = config.contentTypes.includes(type) ? config.contentTypes.filter((t) => t !== type) : [...config.contentTypes, type];
    await save({ contentTypes: next });
  };

  if (!config) return <p className="py-16 text-center text-zinc-500">Loading…</p>;

  const numCls = "w-24 rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-primary-500";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Automatic Posting</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Turn on the engine, choose your approval flow and pick which content is eligible. The scheduler publishes it for
          you on the platform schedules.
        </p>
      </div>

      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">{error}</div>}
      {saved && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-300">Saved.</div>}

      <div className="glass rounded-3xl p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Automation engine</p>
            <h2 className="mt-1 text-lg font-black text-white">
              {config.automationEnabled ? "Enabled" : "Disabled"} {config.paused && "· Paused"}
            </h2>
            <div className="mt-2"><StatusBadge status={config.automationEnabled ? (config.paused ? "needs_refresh" : "QUEUED") : "disconnected"} /></div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {config.automationEnabled && (
              <button
                onClick={() => save({ paused: !config.paused })}
                disabled={saving}
                className="rounded-full border border-amber-500/40 px-5 py-2.5 text-sm font-bold text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
              >
                {config.paused ? "Resume" : "Pause"}
              </button>
            )}
            <button onClick={() => save({ automationEnabled: !config.automationEnabled })} disabled={saving} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {config.automationEnabled ? "Turn off automation" : "Turn on automation"}
            </button>
          </div>
        </div>
        {config.automationEnabled && config.paused && (
          <p className="mt-4 text-sm text-amber-300">Automation is paused. Manual/scheduled posts still fire; no new auto posts are generated.</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-3xl p-7">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Publishing rules</p>

          <div className="mt-5 space-y-5 text-sm">
            <div>
              <label className="mb-1.5 block font-semibold text-zinc-300">Approval mode</label>
              <div className="flex gap-2">
                {(["auto", "approval"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => save({ approvalMode: mode })}
                    className={`flex-1 rounded-2xl border px-4 py-3 text-left transition ${
                      config.approvalMode === mode ? "border-violet-500/60 bg-violet-500/10 text-white" : "border-white/10 text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    <p className="font-bold">{mode === "auto" ? "Publish instantly" : "Manual approval"}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {mode === "auto" ? "Newly eligible content posts as soon as the schedule runs." : "Auto posts wait in the queue until you approve them."}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block font-semibold text-zinc-300">Max posts / day (fallback cap)</label>
                <input type="number" min={1} max={500} value={config.maxPostsPerDay} onChange={(e) => save({ maxPostsPerDay: parseInt(e.target.value, 10) || 10 })} className={numCls} />
              </div>
              <div>
                <label className="mb-1.5 block font-semibold text-zinc-300">Retries</label>
                <input type="number" min={0} max={20} value={config.maxRetries} onChange={(e) => save({ maxRetries: parseInt(e.target.value, 10) || 0 })} className={numCls} />
              </div>
              <div>
                <label className="mb-1.5 block font-semibold text-zinc-300">Retry backoff (min)</label>
                <input type="number" min={1} max={1440} value={config.retryBackoffMinutes} onChange={(e) => save({ retryBackoffMinutes: parseInt(e.target.value, 10) || 30 })} className={numCls} />
              </div>
              <div>
                <label className="mb-1.5 block font-semibold text-zinc-300">Dedupe window (days)</label>
                <input type="number" min={1} max={365} value={config.dedupeWindowDays} onChange={(e) => save({ dedupeWindowDays: parseInt(e.target.value, 10) || 30 })} className={numCls} />
              </div>
            </div>

            <div>
              <label className="mb-2 block font-semibold text-zinc-300">Auto-generate content for</label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleContentScope(t)}
                    className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition ${
                      config.contentTypes.includes(t) ? "bg-violet-600 text-white" : "ring-1 ring-white/10 text-zinc-500 hover:bg-white/5"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl p-7">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Eligibility</p>
          <p className="mt-2 text-sm text-zinc-400">Flip the switch on any item to opt it in or out of automatic posting.</p>

          {content && (
            <div className="mt-4 space-y-5 max-h-[26rem] overflow-y-auto pr-2">
              {[
                { label: "Celebrities", rows: content.celebrities ?? [] },
                { label: "Products", rows: content.memberships ?? [] },
                { label: "Events", rows: content.events ?? [] },
                { label: "Articles", rows: content.articles ?? [] },
              ].map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-500">{group.label}</p>
                  {group.rows.length === 0 ? (
                    <EmptyState text={`No ${group.label.toLowerCase()} available.`} />
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {group.rows.map((r: { id: string; name: string; autoPost?: boolean; when?: string | null; status?: string }) => (
                        <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-ink-950/50 px-4 py-2.5 ring-1 ring-white/[0.06]">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{r.name}</p>
                            {(r.when || r.status) && (
                              <p className="text-xs text-zinc-500">
                                {r.when ? new Date(r.when).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                                {r.status ? ` · ${r.status}` : ""}
                              </p>
                            )}
                          </div>
                          <Toggle on={Boolean(r.autoPost)} onToggle={() => toggleEligibility(group.label.toLowerCase().replace(/ies$/, "y").replace(/s$/, ""), r.id, !r.autoPost)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}