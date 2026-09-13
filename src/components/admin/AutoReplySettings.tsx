"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CelebrityRow = { id: string; slug: string; name: string; enabled: boolean };

type SaveTarget = { kind: "global"; enabled: boolean } | { kind: "celebrity"; celebrityId: string; enabled: boolean };

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full ring-1 ring-inset transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-primary-500 ring-primary-400/50" : "bg-white/10 ring-white/15"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function AutoReplySettings() {
  const router = useRouter();
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [celebMap, setCelebMap] = useState<Record<string, boolean>>({});
  const [celebList, setCelebList] = useState<CelebrityRow[]>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/reply", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load toggle state");
      const data = (await res.json()) as {
        globalEnabled: boolean;
        celebrities: CelebrityRow[];
      };
      setGlobalEnabled(data.globalEnabled);
      setCelebList(data.celebrities);
      setCelebMap(Object.fromEntries(data.celebrities.map((c) => [c.id, c.enabled])));
      setError(null);
    } catch {
      setError("Could not load AI reply settings.");
    } finally {
      setLoaded(true);
    }
  }, [router]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const save = async (target: SaveTarget) => {
    const key =
      target.kind === "global" ? "global" : `celeb:${target.celebrityId}`;
    setSaving((prev) => ({ ...prev, [key]: true }));
    if (target.kind === "global") setGlobalEnabled(target.enabled);
    else setCelebMap((prev) => ({ ...prev, [target.celebrityId]: target.enabled }));
    try {
      const res = await fetch("/api/admin/ai/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          target.kind === "global"
            ? { globalEnabled: target.enabled }
            : { celebrityId: target.celebrityId, enabled: target.enabled },
        ),
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to save");
      setError(null);
    } catch {
      setError("Could not save the change — try again.");
      if (target.kind === "global") setGlobalEnabled((prev) => !prev);
      else
        setCelebMap((prev) => ({
          ...prev,
          [target.celebrityId]: !prev[target.celebrityId],
        }));
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="mb-6 rounded-3xl border border-white/10 bg-ink-950/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-200">
            AI auto-replies
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-500">
            When the switch is ON, the AI replies to fans on its own, 24/7, in
            each celebrity&apos;s voice. Switch it OFF for manual mode: fans only
            get the replies <span className="text-zinc-300">you</span> send from
            this inbox, and the AI stays quiet until you turn it back on.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loaded && (
            <span
              className={`text-xs font-bold ${
                globalEnabled ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {globalEnabled ? "ON" : "MANUAL"}
            </span>
          )}
          <Toggle
            checked={globalEnabled}
            disabled={!loaded || !!saving["global"]}
            label="Global AI auto-replies"
            onChange={(next) => void save({ kind: "global", enabled: next })}
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      {loaded && !globalEnabled && (
        <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200">
          Manual mode is on — AI auto-replies are paused everywhere. Answer fans
          yourself by opening any conversation below. When you switch the AI back
          on, it continues each chat using the full history, so your manual
          replies flow naturally into the AI&apos;s.
        </p>
      )}

      {loaded && celebList.length > 0 && (
        <div className="mt-5 max-h-64 space-y-1 overflow-y-auto pr-1">
          {celebList.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.03]"
            >
              <span className="min-w-0 truncate text-sm font-semibold text-zinc-200">
                {c.name}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide ${
                    celebMap[c.id] ? "text-emerald-400/80" : "text-zinc-500"
                  }`}
                >
                  {celebMap[c.id] ? "AI on" : "Manual"}
                </span>
                <Toggle
                  checked={!!celebMap[c.id]}
                  disabled={!!saving[`celeb:${c.id}`]}
                  label={`AI auto-replies for ${c.name}`}
                  onChange={(next) =>
                    void save({ kind: "celebrity", celebrityId: c.id, enabled: next })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}