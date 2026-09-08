"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtDate, PlatformMark, StatusBadge } from "./SocialUI";

interface Schedule {
  id: string;
  platformKey: string;
  platformName: string;
  platformColor: string;
  name: string | null;
  enabled: boolean;
  contentTypes: string[];
  frequency: string;
  intervalMinutes: number | null;
  times: string[];
  weekdays: number[];
  maxPerDay: number | null;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
}

const CONTENT_TYPES = ["celebrity", "membership", "event", "article", "promo"];
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const inputCls = "rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-primary-500";

export default function SchedulesManager() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ schedules: Schedule[] }>("/api/social/admin/schedules");
      setSchedules(d.schedules);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const save = async (platformKey: string, patch: Partial<Schedule>) => {
    const s = schedules.find((x) => x.platformKey === platformKey);
    if (!s) return;
    const next = { ...s, ...patch, platformKey: s.platformKey };
    setSavingKey(platformKey);
    setError(null);
    try {
      await api("/api/social/admin/schedules", {
        method: "PUT",
        body: JSON.stringify({
          platformKey,
          enabled: next.enabled,
          name: next.name,
          contentTypes: next.contentTypes,
          frequency: next.frequency,
          intervalMinutes: next.intervalMinutes,
          times: next.times,
          weekdays: next.weekdays,
          maxPerDay: next.maxPerDay,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save schedule");
    } finally {
      setSavingKey(null);
    }
  };

  const toggleType = (key: string, type: string) => {
    const s = schedules.find((x) => x.platformKey === key);
    if (!s) return;
    const next = s.contentTypes.includes(type) ? s.contentTypes.filter((t) => t !== type) : [...s.contentTypes, type];
    save(key, { contentTypes: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Platform Schedules</h1>
        <p className="mt-1 text-sm text-zinc-400">
          When automation is on, each enabled platform scans at these times and queues any new eligible content. A schedule
          won&apos;t post more than its daily cap.
        </p>
      </div>

      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">{error}</div>}

      {loading ? (
        <p className="py-16 text-center text-zinc-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          {schedules.map((s) => (
            <section key={s.id} className="glass rounded-3xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <PlatformMark name={s.platformName} color={s.platformColor} />
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-black text-white">{s.platformName}</h2>
                      <StatusBadge status={s.enabled ? "QUEUED" : "disconnected"} />
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {s.enabled
                        ? s.frequency === "hourly"
                          ? `every ${s.intervalMinutes ?? 60} min`
                          : s.frequency === "custom"
                          ? `every ${s.intervalMinutes ?? 1440} min`
                          : s.frequency === "weekly"
                          ? `weekly on ${s.weekdays.map((d) => WEEKDAY_NAMES[d] ?? d).join(", ")} at ${s.times.join(", ")}`
                          : `daily at ${s.times.join(" · ")}`
                        : "Disabled"}
                      {s.maxPerDay ? ` · max ${s.maxPerDay}/day` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Next scan: {s.nextRunAt ? fmtDate(s.nextRunAt) : "—"} {s.lastRunAt ? `· last: ${fmtDate(s.lastRunAt)}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => save(s.platformKey, { enabled: !s.enabled })}
                  disabled={savingKey === s.platformKey}
                  className={`rounded-full px-5 py-2.5 text-sm font-bold transition disabled:opacity-50 ${s.enabled ? "border border-amber-500/40 text-amber-300 hover:bg-amber-500/10" : "btn-grad text-white"}`}
                >
                  {s.enabled ? "Disable" : "Enable"}
                </button>
              </div>

              <div className="mt-5 grid gap-6 border-t border-white/[0.06] pt-5 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Auto-generate for</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CONTENT_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => toggleType(s.platformKey, t)}
                        disabled={savingKey === s.platformKey}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition disabled:opacity-50 ${
                          s.contentTypes.includes(t) ? "bg-violet-600 text-white" : "ring-1 ring-white/10 text-zinc-500 hover:bg-white/5"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-400">Frequency</label>
                    <select
                      value={s.frequency}
                      onChange={(e) => save(s.platformKey, { frequency: e.target.value })}
                      className={`${inputCls} w-full`}
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="custom">Custom interval</option>
                    </select>
                  </div>
                  {(s.frequency === "hourly" || s.frequency === "custom") && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-400">Interval (minutes)</label>
                      <input
                        type="number"
                        min={5}
                        value={s.intervalMinutes ?? 60}
                        onChange={(e) => save(s.platformKey, { intervalMinutes: parseInt(e.target.value, 10) || 60 })}
                        className={`${inputCls} w-full`}
                      />
                    </div>
                  )}
                  {s.frequency === "daily" && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-400">Times of day</label>
                      <textarea
                        value={s.times.join("\n")}
                        onChange={(e) => save(s.platformKey, { times: e.target.value.split("\n").map((t) => t.trim()).filter(Boolean) })}
                        className={`${inputCls} w-full`}
                        rows={2}
                        placeholder={"09:00\n18:00"}
                      />
                    </div>
                  )}
                  {s.frequency === "weekly" && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-400">Day of week</label>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAY_NAMES.map((d, i) => (
                          <button
                            key={d}
                            onClick={() => {
                              const set = new Set(s.weekdays);
                              if (set.has(i)) {
                                set.delete(i);
                              } else {
                                set.add(i);
                              }
                              save(s.platformKey, { weekdays: [...set].sort() });
                            }}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                              s.weekdays.includes(i) ? "bg-violet-600 text-white" : "ring-1 ring-white/10 text-zinc-500"
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-400">Daily cap (platform)</label>
                    <input
                      type="number"
                      min={1}
                      value={s.maxPerDay ?? 5}
                      onChange={(e) => save(s.platformKey, { maxPerDay: parseInt(e.target.value, 10) || 5 })}
                      className={`${inputCls} w-full`}
                    />
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}