"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderActions({ orderRef, token }: { orderRef: string; token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: "pay" | "cancel") {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tickets/orders/${encodeURIComponent(orderRef)}/${action}?t=${token}`, { method: "POST" });
      const data = await res.json();
      setMessage(data.message || (res.ok ? "Done." : "Something went wrong."));
      router.refresh();
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {message && (
        <p className="rounded-xl bg-white/[0.05] px-4 py-3 text-sm text-zinc-300 ring-1 ring-white/10">{message}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={() => run("pay")}
          disabled={busy}
          className="btn-grad rounded-full px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Working…" : "Try to pay now"}
        </button>
        <button
          onClick={() => run("cancel")}
          disabled={busy}
          className="rounded-full px-6 py-3 text-sm font-semibold text-zinc-300 ring-1 ring-white/20 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cancel order
        </button>
      </div>
    </div>
  );
}