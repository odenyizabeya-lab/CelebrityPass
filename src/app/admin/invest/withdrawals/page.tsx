"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Withdrawal = {
  id: string;
  ref: string;
  amount: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  investor: { number: string; email: string; name: string };
};

const FILTERS = ["REQUESTED", "PROCESSING", "REJECTED", "COMPLETED"];

export default function AdminInvestWithdrawalsPage() {
  const [filter, setFilter] = useState("REQUESTED");
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    fetch(`/api/admin/invest/withdrawals?status=${filter}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((d) => setRows(d.withdrawals))
      .catch(() => setError("Could not load withdrawals."));
  }
  useEffect(load, [filter]);

  async function act(id: string, action: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invest/withdrawals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Action failed.");
        return;
      }
      load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-white">Withdrawals</h1>
        <Link href="/admin/invest" className="text-sm text-zinc-400 hover:text-white">← Investor overview</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-2 text-sm font-bold transition ${filter === f ? "bg-primary-600 text-white" : "border border-zinc-700 text-zinc-400 hover:bg-zinc-800"}`}>
            {f}
          </button>
        ))}
      </div>
      {error && <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-400">{error}</p>}

      <div className="overflow-x-auto rounded-3xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-widest text-zinc-500">
              <th className="px-4 py-3">Ref</th>
              <th className="px-4 py-3">Investor</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className="border-b border-zinc-800/60 last:border-0">
                <td className="px-4 py-3 font-bold text-white">{w.ref}</td>
                <td className="px-4 py-3">
                  <p className="text-zinc-300">{w.investor.name}</p>
                  <p className="text-xs text-zinc-500">{w.investor.number} · {w.investor.email}</p>
                </td>
                <td className="px-4 py-3 font-bold text-white">${Number(w.amount).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${w.status === "COMPLETED" ? "bg-emerald-500/15 text-emerald-400" : w.status === "REJECTED" ? "bg-rose-500/15 text-rose-400" : w.status === "PROCESSING" ? "bg-amber-500/15 text-amber-400" : "bg-zinc-800 text-zinc-300"}`}>{w.status}</span>
                </td>
                <td className="px-4 py-3 text-zinc-400">{new Date(w.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  {w.status === "REQUESTED" && (
                    <div className="flex gap-1.5">
                      <button disabled={busy === w.id} onClick={() => act(w.id, "APPROVE")} className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50">Approve</button>
                      <button disabled={busy === w.id} onClick={() => act(w.id, "REJECT")} className="rounded-full bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/25 disabled:opacity-50">Reject</button>
                    </div>
                  )}
                  {w.status === "PROCESSING" && (
                    <button disabled={busy === w.id} onClick={() => act(w.id, "COMPLETE")} className="rounded-full bg-primary-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-500 disabled:opacity-50">Mark paid</button>
                  )}
                  {(w.status === "COMPLETED" || w.status === "REJECTED") && (
                    <span className="text-xs text-zinc-500">Closed</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No withdrawals in {filter}.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-600">
        Only the backend marks a withdrawal paid — after a simulated (demo) provider confirmation and a balanced ledger
        debit. In live mode a real payout provider webhook would drive the same code path.
      </p>
    </div>
  );
}