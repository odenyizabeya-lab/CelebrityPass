"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/payments";

type PendingProof = {
  id: string;
  amountCents: number;
  currency: string;
  senderName: string | null;
  reference: string | null;
  transferDate: string | null;
  fileName: string | null;
  fileUrl: string | null;
  createdAt: string;
  bankAccountCurrency: string | null;
  bankAccountCountry: string | null;
};

type TicketItem = { name: string; quantity: number; unitPriceCents: number };
type ProofDetail = {
  proof: {
    id: string;
    senderName: string | null;
    transferDate: string | null;
    fileName: string | null;
    fileUrl: string | null;
    bankAccount: { beneficiary: string; bankName: string } | null;
  };
  payment: { description: string | null; celebrity: string | null; fanEmail: string | null } | null;
  ticketOrder: { orderRef: string; event: string; items: TicketItem[] } | null;
};

export default function AdminVerifyTransfers({ proofs }: { proofs: PendingProof[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProofDetail | null>(null);
  const [note, setNote] = useState("");

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/tickets/admin/bank-proofs/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, adminNote: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not review this transfer.");
      setNote("");
      setDetail(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not review this transfer.");
    } finally {
      setBusyId(null);
    }
  }

  async function openDetail(id: string) {
    setError(null);
    setOpenId(id);
    try {
      const res = await fetch(`/api/tickets/admin/bank-proofs/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load details.");
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load details.");
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30">
          {proofs.length}
        </span>
        <h2 className="text-lg font-black text-white">Pending verification</h2>
      </div>

      {proofs.length === 0 ? (
        <div className="rounded-xl bg-white/[0.03] p-6 text-center text-sm text-zinc-400 ring-1 ring-white/10">
          No transfers waiting for verification.
        </div>
      ) : (
        <div className="space-y-3">
          {proofs.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white">{formatMoney(p.amountCents / 100, p.currency)}</p>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                      pending
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">
                    {p.senderName ?? "Unknown sender"}
                    {p.reference ? <span className="font-mono text-zinc-300"> · {p.reference}</span> : null}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {`${p.bankAccountCurrency ?? ""}${p.bankAccountCountry ? ` · ${p.bankAccountCountry}` : ""}`} ·{" "}
                    {new Date(p.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => (openId === p.id ? setOpenId(null) : openDetail(p.id))}
                    className="rounded-full px-4 py-1.5 text-xs font-bold text-zinc-300 ring-1 ring-white/10 transition hover:text-white"
                  >
                    {openId === p.id ? "Close" : "Review"}
                  </button>
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
                    {busyId === p.id ? "Working…" : "Approve & confirm"}
                  </button>
                </div>
              </div>

              {openId === p.id && detail?.proof?.id === p.id && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  {detail.payment && (
                    <div className="rounded-xl bg-white/[0.03] p-3 text-sm">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Fans Card purchase</p>
                      <p className="mt-1 text-zinc-300">
                        {detail.payment.description ?? "Fan Card"}
                        {detail.payment.celebrity ? ` · ${detail.payment.celebrity}` : ""}
                        {detail.payment.fanEmail ? ` · ${detail.payment.fanEmail}` : ""}
                      </p>
                    </div>
                  )}
                  {detail.ticketOrder && (
                    <div className="rounded-xl bg-white/[0.03] p-3 text-sm">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Ticket order {detail.ticketOrder.orderRef}</p>
                      <p className="mt-1 text-zinc-300">
                        {detail.ticketOrder.event}
                        {detail.ticketOrder.items
                          ? ` · ${detail.ticketOrder.items.map((i) => `${i.name}×${i.quantity}`).join(", ")}`
                          : ""}
                      </p>
                    </div>
                  )}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white/[0.03] p-3 text-sm text-zinc-300">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Details</p>
                      <p className="mt-1">
                        Sender: {detail.proof.senderName ?? "—"} · Date: {detail.proof.transferDate ? new Date(detail.proof.transferDate).toLocaleDateString() : "—"}
                      </p>
                      <p className="mt-1">To: {detail.proof.bankAccount?.beneficiary ?? "—"} ({detail.proof.bankAccount?.bankName ?? ""})</p>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Proof</p>
                      {detail.proof.fileUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={detail.proof.fileUrl} alt="Transfer proof" className="mt-2 max-h-48 w-full rounded-lg object-contain ring-1 ring-white/10" />
                      ) : (
                        <p className="mt-1 text-sm text-zinc-500">No proof attached.</p>
                      )}
                      {detail.proof.fileName && <p className="mt-1 text-xs text-zinc-500">{detail.proof.fileName}</p>}
                    </div>
                  </div>
                  <label className="mt-4 block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Admin note</span>
                    <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" placeholder="Optional note (shown to the customer in history)" />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}