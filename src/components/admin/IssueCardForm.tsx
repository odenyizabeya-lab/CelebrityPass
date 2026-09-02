"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function IssueCardForm({
  celebrities,
}: {
  celebrities: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [fanQuery, setFanQuery] = useState("");
  const [fanId, setFanId] = useState<string | null>(null);
  const [fanList, setFanIdList] = useState<{ id: string; name: string; email: string; cardCount: number }[]>([]);
  const [celebrityId, setCelebrityId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [levels, setLevels] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ fanNumber: string; slug: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const searchFans = async () => {
    setFanId(null);
    setResult(null);
    if (!fanQuery.trim()) return;
    const res = await fetch(`/api/fans?search=${encodeURIComponent(fanQuery.trim())}`);
    const data = await res.json();
    const fans = (data.fans ?? []) as { id: string; name: string; email: string; cardCount: number }[];
    if (fans.length === 0) {
      setError("No fans found for that search.");
      setFanIdList([]);
      return;
    }
    setFanIdList(fans);
  };

  const loadLevels = async (celebrityId: string) => {
    setLevels([]);
    setLevelId("");
    if (!celebrityId) return;
    const res = await fetch(`/api/celebrities/${celebrityId}/memberships?includeInactive=true`);
    const data = await res.json();
    setLevels((data.memberships ?? []) as { id: string; name: string }[]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!fanId || !celebrityId) {
      setError("Select both a fan and a celebrity community.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fanId, celebrityId, membershipLevelId: levelId || undefined }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to issue card.");
      return;
    }
    setResult({ fanNumber: data.card.fanNumber, slug: data.card.celebrity.slug });
    setFanQuery("");
    setFanId(null);
    setFanIdList([]);
    setCelebrityId("");
    setLevels([]);
    setLevelId("");
    router.refresh();
  };

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500";

  return (
    <form onSubmit={submit} className="glass mt-6 rounded-3xl p-6 sm:p-8">
      <h2 className="text-lg font-black tracking-tight">Issue a Card Manually</h2>
      <p className="mt-1 text-sm text-zinc-400">Issue a fan card for an existing fan in any community.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Fan</label>
          <div className="flex gap-2">
            <input
              value={fanQuery}
              onChange={(e) => setFanQuery(e.target.value)}
              className={inputCls}
              placeholder="Search name / email…"
            />
            <button
              type="button"
              onClick={searchFans}
              className="shrink-0 rounded-xl bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
            >
              Find
            </button>
          </div>
          {fanList.length > 0 && (
            <ul className="mt-2 overflow-hidden rounded-xl border border-white/10 text-sm">
              {fanList.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setFanId(f.id);
                      setFanIdList([]);
                      setFanQuery(`${f.name} (${f.email})`);
                    }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-white/5"
                  >
                    <span>
                      <span className="font-semibold text-white">{f.name}</span>
                      <span className="ml-2 text-xs text-zinc-500">{f.email}</span>
                    </span>
                    <span className="text-xs text-zinc-500">{f.cardCount} card(s)</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fanId && <p className="mt-1 text-xs text-emerald-300">Fan selected ✓</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Community</label>
          <select
            value={celebrityId}
            onChange={(e) => {
              setCelebrityId(e.target.value);
              loadLevels(e.target.value);
            }}
            className={inputCls}
          >
            <option value="">Select a celebrity…</option>
            {celebrities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Level (optional)</label>
          <select value={levelId} onChange={(e) => setLevelId(e.target.value)} className={inputCls}>
            <option value="">Default</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={busy}
            className="btn-grad rounded-xl px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "Issuing…" : "Issue Card"}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      {result && (
        <a
          href={`/celebrity/${result.slug}/fan/${result.fanNumber}`}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/25"
        >
          Card {result.fanNumber} issued — open it →
        </a>
      )}
    </form>
  );
}