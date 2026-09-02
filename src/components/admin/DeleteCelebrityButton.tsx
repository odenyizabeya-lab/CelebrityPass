"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteCelebrityButton({ id, name, cardCount }: { id: string; name: string; cardCount: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const del = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/celebrities/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError((await res.json().catch(() => null))?.error ?? "Failed to delete.");
        setBusy(false);
        return;
      }
      router.push("/admin/celebrities");
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  };

  return (
    <div>
      {error && <p className="mb-3 text-sm text-rose-300">{error}</p>}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
          <p className="text-sm text-rose-200">
            Permanently delete <strong>{name}</strong> and all {cardCount} card(s)? This cannot be undone.
          </p>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setConfirming(false)} disabled={busy} className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:text-white">
              Cancel
            </button>
            <button
              onClick={del}
              disabled={busy}
              className="rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-500 disabled:opacity-60"
            >
              {busy ? "Deleting…" : "Yes, delete"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/25 transition hover:bg-rose-500/10 hover:text-rose-200"
        >
          Delete this community
        </button>
      )}
    </div>
  );
}