"use client";

import { useState } from "react";

export default function WithdrawForm({ kycStatus }: { kycStatus: string }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/invest/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Request failed.");
        return;
      }
      setOk(`Withdrawal ${data.withdrawal?.ref} requested — it will be reviewed before any payout.`);
      setAmount("");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (kycStatus !== "VERIFIED") {
    return <p className="mt-3 text-sm text-amber-400">Identity verification (KYC) must be completed before any withdrawal may be processed.</p>;
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
      <button type="submit" disabled={busy} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {busy ? "Submitting…" : "Request withdrawal"}
      </button>
    </form>
  );
}