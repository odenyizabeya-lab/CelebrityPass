"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type DepositProof = {
  id: string;
  amountCents: number;
  currency: string;
  senderName: string | null;
  reference: string | null;
  transferDate: string | null;
  fileName: string | null;
  fileUrl: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  bankAccountCurrency: string | null;
  bankAccountCountry: string | null;
  investorNumber: string | null;
  fanName: string | null;
  fanEmail: string | null;
  depositRef: string | null;
  txnRef: string | null;
  txnStatus: string | null;
  opportunityName: string | null;
  opportunitySlug: string | null;
};

const FILTERS = ["PENDING_VERIFICATION", "APPROVED", "REJECTED"] as const;

export default function AdminInvestDepositsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("PENDING_VERIFICATION");
  const [rows, setRows] = useState<DepositProof[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/invest/deposits")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((d) => setRows(d.proofs))
      .catch(() => setError("Could not load investor deposits."));
  }, []);
  useEffect(load, [load]);

  const filtered = rows.filter((p) => p.status === filter);

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invest/deposits/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, adminNote: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not review this deposit.");
      setNote("");
      setOpenId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not review this deposit.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Investor Deposits</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Review each Bank Transfer / ATM receipt against your real bank statement before approving. Nothing is auto-paid.
          </p>
        </div>
        <Link href="/admin/invest" className="text-sm text-zinc-400 hover:text-white">← Investor overview</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              filter === f ? "bg-primary-600 text-white" : "border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {f === "PENDING_VERIFICATION" ? "Pending" : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-400">{error}</p>}

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] p-8 text-center text-sm text-zinc-500 ring-1 ring-white/10">
          No deposits in this state.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-black text-white">${(p.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      p.status === "APPROVED"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : p.status === "REJECTED"
                          ? "bg-rose-500/15 text-rose-400"
                          : "bg-amber-500/15 text-amber-400"
                    }`}>
                      {p.status === "PENDING_VERIFICATION" ? "pending" : p.status.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-300">
                    {p.fanName ?? "Unknown investor"} · {p.investorNumber ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Deposit {p.depositRef ?? p.txnRef ?? "—"}
                    {p.senderName ? ` · sender: ${p.senderName}` : ""}
                    {p.reference ? ` · ref: ${p.reference}` : ""}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {p.opportunityName ? `Investment: ${p.opportunityName}` : "General deposit"} ·{" "}
                    {new Date(p.createdAt).toLocaleString()}
                    {p.transferDate ? ` · paid ${new Date(p.transferDate).toLocaleDateString()}` : ""}
                  </p>
                  {p.adminNote && (
                    <p className="mt-1 text-xs italic text-zinc-500">Admin note: {p.adminNote}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOpenId(openId === p.id ? null : p.id)}
                    className="rounded-full px-4 py-1.5 text-xs font-bold text-zinc-300 ring-1 ring-white/10 transition hover:text-white"
                  >
                    {openId === p.id ? "Close" : "Review receipt"}
                  </button>
                  {p.status === "PENDING_VERIFICATION" && (
                    <>
                      <button
                        onClick={() => decide(p.id, "REJECT")}
                        disabled={busyId === p.id}
                        className="rounded-full px-4 py-1.5 text-xs font-bold text-rose-300 ring-1 ring-rose-500/20 transition hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => decide(p.id, "APPROVE")}
                        disabled={busyId === p.id}
                        className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {busyId === p.id ? "Working…" : "Approve & credit"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {openId === p.id && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white/[0.03] p-3 text-sm text-zinc-300">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Deposit</p>
                      <p className="mt-1">
                        Reference: <span className="font-mono text-white">{p.depositRef ?? "—"}</span>
                      </p>
                      <p className="mt-1">
                        Transaction: <span className="font-mono text-white">{p.txnRef ?? "—"}</span> · status{" "}
                        <span className="text-white">{p.txnStatus ?? "—"}</span>
                      </p>
                      <p className="mt-1">Investor: {p.fanName ?? "—"} ({p.fanEmail ?? "—"})</p>
                      <p className="mt-1">
                        Paid to: {p.bankAccountCurrency ?? ""}
                        {p.bankAccountCountry ? ` · ${p.bankAccountCountry}` : ""}
                      </p>
                      <p className="mt-1">Sender name: {p.senderName ?? "—"}</p>
                      {p.opportunityName && <p className="mt-1">Towards: {p.opportunityName} (/invest/opportunities/{p.opportunitySlug})</p>}
                    </div>
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Receipt</p>
                      {p.fileUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.fileUrl} alt="Deposit receipt" className="mt-2 max-h-64 w-full rounded-lg object-contain ring-1 ring-white/10" />
                      ) : (
                        <p className="mt-1 text-sm text-zinc-500">No receipt attached.</p>
                      )}
                      {p.fileName && <p className="mt-1 text-xs text-zinc-500">{p.fileName}</p>}
                    </div>
                  </div>
                  {p.status === "PENDING_VERIFICATION" && (
                    <label className="mt-4 block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Admin note</span>
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                        placeholder="Optional note shown to the investor"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-600">
        Approving a receipt is the only action that credits the investor&apos;s ledger — after an admin confirms the real
        money arrived. Approved deposits toward an open investment are subscribed automatically.
      </p>
    </div>
  );
}