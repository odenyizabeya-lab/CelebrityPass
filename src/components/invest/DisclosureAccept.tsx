"use client";

import { useState } from "react";

type Disclosure = { key: string; version: string; title: string; accepted: boolean };

export default function DisclosureAccept({ slug, disclosures }: { slug: string; disclosures: Disclosure[] }) {
  const [state, setState] = useState(disclosures);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAccepted = state.length > 0 && state.every((d) => d.accepted);

  async function accept(doc: Disclosure) {
    if (doc.accepted) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invest/opportunities/${slug}/disclosures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: doc.key, version: doc.version, title: doc.title }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not record acceptance.");
        return;
      }
      setState((prev) => prev.map((d) => (d.key === doc.key && d.version === doc.version ? { ...d, accepted: true } : d)));
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (state.length === 0) return null;

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
      <h3 className="text-lg font-extrabold text-white">Required disclosures</h3>
      <p className="mt-1 text-sm text-zinc-400">You must review and accept each document before subscribing.</p>
      <ul className="mt-4 space-y-2">
        {state.map((d) => (
          <li key={`${d.key}:${d.version}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 px-4 py-3">
            <span className="text-sm text-zinc-200">
              {d.title} <span className="text-zinc-600">v{d.version}</span>
            </span>
            {d.accepted ? (
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400">Accepted</span>
            ) : (
              <button type="button" onClick={() => accept(d)} disabled={busy} className="rounded-full border border-zinc-700 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-zinc-800 disabled:opacity-50">
                {busy ? "Saving…" : "Accept"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>}
      {allAccepted ? (
        <p className="mt-3 text-sm text-emerald-400">All required disclosures accepted — you may now subscribe.</p>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">Subscriptions are blocked until every required document is accepted.</p>
      )}
    </div>
  );
}