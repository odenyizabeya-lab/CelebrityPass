"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminCardRow } from "@/lib/services";

export default function CardRowActions({ card }: { card: AdminCardRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const setStatus = async (status: "ACTIVE" | "SUSPENDED" | "EXPIRED") => {
    setBusy(true);
    const res = await fetch(`/api/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
  };

  const del = async () => {
    if (!confirm(`Delete card ${card.fanNumber}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  };

  const url = `/celebrity/${card.celebritySlug}/fan/${card.fanNumber}`;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        disabled={busy}
        onClick={() => navigator.clipboard?.writeText(`http://localhost:3000${url}`)}
        className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:text-white disabled:opacity-50"
      >
        Copy Link
      </button>
      {card.status !== "ACTIVE" && (
        <button
          disabled={busy}
          onClick={() => setStatus("ACTIVE")}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/20 transition hover:text-emerald-200 disabled:opacity-50"
        >
          Activate
        </button>
      )}
      {card.status !== "SUSPENDED" && (
        <button
          disabled={busy}
          onClick={() => setStatus("SUSPENDED")}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/20 transition hover:text-amber-200 disabled:opacity-50"
        >
          Suspend
        </button>
      )}
      <button
        disabled={busy}
        onClick={del}
        className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-400/80 ring-1 ring-rose-500/20 transition hover:text-rose-300 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}