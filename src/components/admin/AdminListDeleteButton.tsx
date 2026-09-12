"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Compact per-row delete for the admin celebrities list. Stops propagation so
 * a tap never triggers the row's navigation, and refreshes in place after a
 * successful delete so the row disappears without a full page navigation.
 */
export default function AdminListDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const del = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/celebrities/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to delete. Check the community's events/bookings and try again.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  };

  return (
    <span onClick={(e) => e.stopPropagation()} className="relative flex min-w-0 flex-col items-end">
      {error && <p className="mb-2 max-w-56 text-right text-[11px] leading-snug text-rose-300">{error}</p>}
      {confirming ? (
        <span className="flex flex-wrap items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2">
          <span className="text-xs font-semibold text-rose-200">
            Delete <strong>{name}</strong> and all its data?
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(false);
            }}
            disabled={busy}
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void del();
            }}
            disabled={busy}
            className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-rose-500 disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Yes, delete"}
          </button>
        </span>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          className="rounded-full px-4 py-2 text-sm font-semibold text-rose-300/80 ring-1 ring-rose-500/20 transition hover:bg-rose-500/10 hover:text-rose-200"
        >
          Delete
        </button>
      )}
    </span>
  );
}