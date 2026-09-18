"use client";

import { useState } from "react";

export default function DepositForm({ cardEnabled = false }: { cardEnabled?: boolean }) {
  const [amount, setAmount] = useState("1000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    setNotice(null);
    try {
      const res = await fetch("/api/invest/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, clientRef: `ui:${Date.now()}` }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Deposit failed.");
        return;
      }
      if (data.mode === "card" && data.link) {
        // Real card path — send the investor to the hosted checkout page.
        setNotice("You are being redirected to our secure payment page to complete your deposit…");
        window.location.assign(String(data.link));
        return;
      }
      setOk(`Deposit confirmed — reference ${data.txnRef}.`);
      setAmount("");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm text-zinc-400">
        Amount (USD)
        <input
          type="number"
          min="100"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500"
        />
      </label>
      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>}
      {ok && <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{ok}</p>}
      {notice && <p className="rounded-xl bg-sky-500/10 px-3 py-2 text-sm text-sky-300">{notice}</p>}
      <button type="submit" disabled={busy} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {busy ? "Processing…" : cardEnabled ? "Deposit with ATM Card" : "Add demo funds"}
      </button>
    </form>
  );
}