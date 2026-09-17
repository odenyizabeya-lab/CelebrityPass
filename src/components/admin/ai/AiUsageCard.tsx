"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type UsageDay = {
  day: string;
  requests: number;
  promptTokens: number;
  outputTokens: number;
  thoughtsTokens: number;
};

type Usage = {
  keyLast4: string | null;
  today: UsageDay;
  history: { day: string; requests: number; totalTokens: number }[];
  quotaHits: number;
  lastQuotaAt: string | null;
  lastQuotaMessage: string | null;
};

type Status = {
  assistant: {
    keyConfigured: boolean;
    keyLast4: string;
    usage: Usage | null;
    dailyBudgetRequests: number | null;
  };
};

export default function AiUsageCard() {
  const [data, setData] = useState<Status | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hasBudgetInputRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/ai/settings", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Status;
        if (cancelled) return;
        setData(json);
        if (!hasBudgetInputRef.current) {
          const current = json.assistant.dailyBudgetRequests;
          if (current) hasBudgetInputRef.current = true;
          setBudgetInput(current ? String(current) : "");
        }
      } catch {
        // transient — next poll retries
      }
    }
    void load();
    const t = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  async function saveBudget() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantDailyBudget: String(budgetInput).trim() }),
      });
      if (!res.ok) throw new Error("save failed");
      const json = (await res.json()) as Status;
      setData(json);
      hasBudgetInputRef.current = true;
      const current = json.assistant.dailyBudgetRequests;
      setBudgetInput(current ? String(current) : "");
    } catch {
      setError("Could not save — try again.");
    } finally {
      setSaving(false);
    }
  }

  const usage = data?.assistant?.usage ?? null;
  const budget = data?.assistant?.dailyBudgetRequests ?? null;
  const requestsToday = usage?.today.requests ?? 0;
  const quotaHit = (usage?.quotaHits ?? 0) > 0;
  const remaining = budget !== null ? Math.max(0, budget - requestsToday) : null;

  const pct = budget && budget > 0 ? Math.min(100, (requestsToday / budget) * 100) : 0;
  const barColor = quotaHit || (budget && remaining !== null && remaining <= 0)
    ? "bg-rose-400"
    : budget && remaining !== null && remaining / budget < 0.25
      ? "bg-amber-400"
      : "bg-emerald-400";

  return (
    <div className="glass mt-6 rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Fan-chat AI key</h2>
          <p className="mt-0.5 text-sm text-zinc-400">
            The Gemini coin driving celebrity replies — watching it burn down live so you can swap the key before fans
            notice.
          </p>
        </div>
        <HealthPill usage={usage} budget={budget} remaining={remaining} />
      </div>

      {budget === null ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-4">
          <p className="text-sm font-semibold text-white">No daily budget yet — set it to see the meter burn down</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            Google shows your key&apos;s actual limit (requests/day) in{" "}
            <span className="text-zinc-200">AI Studio → your API key</span>. Paste that number here and the meter below
            will count down to zero, so you change the key before it empties.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="e.g. 100"
              className="w-32 rounded-xl border border-white/15 bg-ink-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-400"
            />
            <button
              onClick={() => void saveBudget()}
              disabled={saving}
              className="btn-grad rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Set daily budget"}
            </button>
            {error && <span className="text-xs text-rose-300">{error}</span>}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm font-semibold text-white">
              {requestsToday.toLocaleString()} of {budget.toLocaleString()} daily requests used
            </p>
            <p className={`font-mono text-sm font-bold ${remaining !== null && remaining <= 0 ? "text-rose-300" : remaining !== null && remaining / budget < 0.25 ? "text-amber-300" : "text-emerald-300"}`}>
              {remaining !== null && remaining <= 0
                ? "empty — swap the key now"
                : `${(remaining ?? 0).toLocaleString()} left today`}
            </p>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-500">
            <span>burn today</span>
            <span>{Math.round(pct)}%</span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-zinc-500">Daily budget</span>
            <input
              type="number"
              min={1}
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="w-24 rounded-lg border border-white/15 bg-ink-900 px-2 py-1 font-mono text-sm text-white outline-none focus:border-primary-400"
            />
            <button
              onClick={() => void saveBudget()}
              disabled={saving}
              className="rounded-lg border border-white/15 px-3 py-1 text-xs font-bold text-zinc-200 hover:bg-white/5 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Update"}
            </button>
            {error && <span className="text-xs text-rose-300">{error}</span>}
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Requests today" value={requestsToday.toLocaleString()} />
        <Stat label="Input tokens" value={(usage?.today.promptTokens ?? 0).toLocaleString()} />
        <Stat label="Output tokens" value={(usage?.today.outputTokens ?? 0).toLocaleString()} />
      </div>

      {usage && usage.today.requests > 0 && !budget && (
        <p className="mt-2 text-xs text-zinc-500">
          ≈ {Math.max(1, Math.round(usage.today.outputTokens / usage.today.requests)).toLocaleString()} output tokens
          per reply · key {usage.keyLast4 ?? "—"} · from {usage.today.day}
        </p>
      )}

      {quotaHit && (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3">
          <p className="text-sm font-bold text-rose-300">
            ⚠ This key already hit Gemini&apos;s limit {usage?.quotaHits}× — paste a fresh key in{" "}
            <Link href="/admin/ai-settings" className="underline">
              AI Settings
            </Link>{" "}
            now.
          </p>
          {usage?.lastQuotaAt && (
            <p className="mt-1 text-xs text-rose-300/70">Last hit: {new Date(usage.lastQuotaAt).toLocaleString()}</p>
          )}
          {usage?.lastQuotaMessage && (
            <p className="mt-0.5 truncate text-xs text-rose-300/50" title={usage.lastQuotaMessage}>
              {usage.lastQuotaMessage}
            </p>
          )}
        </div>
      )}

      {usage && usage.history.length > 1 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold text-zinc-400">Requests per day (last {usage.history.length})</p>
          <div className="flex items-end gap-1.5">
            {[...usage.history].reverse().map((h) => (
              <div key={h.day} className="flex flex-1 flex-col items-center gap-1" title={`${h.day} · ${h.requests.toLocaleString()} req`}>
                <div className="flex h-14 w-full items-end overflow-hidden rounded-md bg-white/[0.04]">
                  {usage.history.length > 0 &&
                    (() => {
                      const max = Math.max(...usage.history.map((x) => x.requests), 1);
                      return (
                        <div
                          className={`w-full ${h.requests > 0 ? "bg-primary-400/70" : "bg-white/5"}`}
                          style={{ height: `${Math.max(4, (h.requests / max) * 100)}%` }}
                        />
                      );
                    })()}
                </div>
                <span className="font-mono text-[9px] text-zinc-500">{h.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-zinc-500">
        Counters reset every day (UTC) and restart when you swap keys — one line on the{" "}
        <Link href="/admin/ai-settings" className="text-zinc-300 underline">
          AI Settings
        </Link>{" "}
        page. Google doesn&apos;t publish an exact “% remaining”, so watch the burn here (refreshing every 10s) and
        change the key when it dips — or the red warning appears.
      </p>
    </div>
  );
}

function HealthPill({
  usage,
  budget,
  remaining,
}: {
  usage: Usage | null;
  budget: number | null;
  remaining: number | null;
}) {
  if (usage && (usage?.quotaHits ?? 0) > 0) {
    return (
      <span className="rounded-full bg-rose-500/15 px-4 py-1.5 text-sm font-bold text-rose-300 ring-1 ring-rose-500/40">
        ● LIMIT HIT — swap key now
      </span>
    );
  }
  if (budget && remaining !== null && remaining <= 0) {
    return (
      <span className="rounded-full bg-rose-500/15 px-4 py-1.5 text-sm font-bold text-rose-300 ring-1 ring-rose-500/40">
        ● budget empty — swap key now
      </span>
    );
  }
  if (budget && remaining !== null && remaining / budget < 0.25) {
    return (
      <span className="rounded-full bg-amber-500/15 px-4 py-1.5 text-sm font-bold text-amber-300 ring-1 ring-amber-500/30">
        ● running low —
        {remaining.toLocaleString()} left
      </span>
    );
  }
  if (usage && usage.today.requests > 0) {
    return (
      <span className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-sm font-bold text-emerald-300 ring-1 ring-emerald-500/30">
        ● key working · {usage.today.requests.toLocaleString()} req today
      </span>
    );
  }
  return (
    <span className="rounded-full bg-zinc-500/15 px-4 py-1.5 text-sm font-bold text-zinc-400 ring-1 ring-zinc-500/30">
      ○ no usage yet
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-black text-white">{value}</p>
    </div>
  );
}