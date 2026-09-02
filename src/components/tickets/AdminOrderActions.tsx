"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminOrderActions({ orderId, canRefund }: { orderId: string; canRefund: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"request" | "record">("record");

  async function run() {
    setBusy(true);
    setError(null);
    if (mode === "record" && !reference.trim()) {
      setError("A real refund reference from the ticket source is required.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`/api/tickets/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, reference: reference.trim(), note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed.");
      router.refresh();
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl ring-1 ring-white/10 bg-white/[0.02] p-5">
      <p className="text-sm font-black uppercase tracking-widest text-zinc-500">Refunds</p>
      <p className="mt-1 text-xs text-zinc-500">Report a refund only after money has really moved at the ticket source.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <label className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold ring-1 transition ${mode === "record" ? "bg-white/10 text-white ring-white/25" : "text-zinc-400 ring-white/10"}`}>
          <input type="radio" className="sr-only" checked={mode === "record"} onChange={() => setMode("record")} />
          Record real refund
        </label>
        <label className={`cursor-pointer rounded-full px-4 py-2 text-xs font-semibold ring-1 transition ${mode === "request" ? "bg-white/10 text-white ring-white/25" : "text-zinc-400 ring-white/10"}`}>
          <input type="radio" className="sr-only" checked={mode === "request"} onChange={() => setMode("request")} />
          Log request only
        </label>
      </div>

      {canRefund && (
        <div className="mt-4 space-y-3">
          {mode === "record" && (
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Refund reference from the ticket source (required)"
              className="w-full rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-primary-400"
            />
          )}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-primary-400"
          />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button
            onClick={run}
            disabled={busy}
            className="rounded-full px-5 py-2.5 text-sm font-bold text-white ring-1 ring-rose-400/40 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Working…" : mode === "record" ? "Record refund" : "Log refund request"}
          </button>
        </div>
      )}
      {!canRefund && <p className="mt-3 text-sm text-zinc-500">This order did not capture a paid amount, so it cannot be refunded.</p>}
    </div>
  );
}