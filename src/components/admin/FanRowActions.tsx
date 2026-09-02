"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FanRowActions({ id, name, isActive }: { id: string; name: string; isActive: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const patch = async (data: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch(`/api/fans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
      return true;
    }
    return false;
  };

  const del = async () => {
    if (!confirm(`Delete fan ${name} and all their cards?`)) return;
    setBusy(true);
    const res = await fetch(`/api/fans/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        disabled={busy}
        onClick={() => patch({ isActive: !isActive })}
        className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:text-white disabled:opacity-50"
      >
        {isActive ? "Disable" : "Enable"}
      </button>
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