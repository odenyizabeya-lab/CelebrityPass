"use client";

import { useState } from "react";
import { formatUSD } from "./depositShared";

export type HistoryDeposit = {
  id: string;
  ref: string | null;
  amount: number;
  status: string; // PENDING_VERIFICATION | APPROVED | REJECTED | SUCCESSFUL | ...
  createdAt: string;
  depositRef: string | null;
  method: "BANK_TRANSFER" | "ATM_DEPOSIT" | null;
};

function statusMeta(status: string): { label: string; cls: string } {
  switch (status) {
    case "PENDING_VERIFICATION":
    case "PENDING":
      return { label: "Pending verification", cls: "bg-amber-400/15 text-amber-300 ring-amber-400/30" };
    case "APPROVED":
    case "SUCCESSFUL":
    case "COMPLETED":
      return { label: "Completed", cls: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30" };
    case "REJECTED":
      return { label: "Rejected", cls: "bg-rose-400/15 text-rose-300 ring-rose-400/30" };
    default:
      return { label: status.replace(/_/g, " ").toLowerCase(), cls: "bg-white/[0.06] text-zinc-400 ring-white/15" };
  }
}

/** Compact, tappable deposit history list. */
export default function DepositHistory({ deposits }: { deposits: HistoryDeposit[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (deposits.length === 0) {
    return (
      <div className="rounded-3xl bg-white/[0.02] px-4 py-6 text-center text-[13px] text-zinc-500 ring-1 ring-white/[0.06]">
        No deposits yet. Start one above — your history appears here.
      </div>
    );
  }

  return (
    <div>
      <p className="px-1 text-[15px] font-bold text-white">Deposit history</p>
      <div className="mt-2 overflow-hidden rounded-3xl bg-white/[0.02] ring-1 ring-white/[0.07]">
        {deposits.map((d, i) => {
          const meta = statusMeta(d.status);
          const methodIcon = d.method === "ATM_DEPOSIT" ? "🏧" : "🏦";
          const methodLabel = d.method === "ATM_DEPOSIT" ? "ATM" : "BANK TRANSFER";
          const open = openId === d.id;
          return (
            <div key={d.id || i} className="border-b border-white/[0.05] last:border-0">
              <button
                onClick={() => setOpenId(open ? null : d.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-white/[0.03]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-lg ring-1 ring-white/10">
                  {methodIcon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-black tracking-wide text-white">{methodLabel}</span>
                  <span className="block font-mono text-[11px] text-zinc-500">{d.depositRef ?? d.ref ?? "—"}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[14px] font-black text-white">{formatUSD(d.amount)}</span>
                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${meta.cls}`}>
                    {meta.label}
                  </span>
                </span>
              </button>

              {open && (
                <div className="fade-up rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]">
                  <Row k="Method" v={d.method === "ATM_DEPOSIT" ? "ATM Deposit" : "Bank Transfer"} />
                  <Row k="Deposit reference" v={d.depositRef ?? "—"} mono />
                  <Row k="Transaction" v={d.ref ?? "—"} mono />
                  <Row k="Amount" v={formatUSD(d.amount)} />
                  <Row
                    k="Status"
                    v={meta.label}
                    vCls={meta.cls.includes("text-emerald") ? "text-emerald-300" : meta.cls.includes("text-rose") ? "text-rose-300" : meta.cls.includes("text-amber") ? "text-amber-300" : "text-zinc-300"}
                  />
                  <Row k="Date" v={new Date(d.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ k, v, mono, vCls }: { k: string; v: string; mono?: boolean; vCls?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{k}</span>
      <span className={`text-right text-[13px] font-bold ${mono ? "font-mono" : ""} ${vCls ?? "text-white"}`}>{v}</span>
    </div>
  );
}

/** Shimmer skeleton shown while the history query streams in. */
export function DepositHistorySkeleton() {
  return (
    <div>
      <div className="h-5 w-32 animate-pulse rounded-lg bg-white/[0.06]" />
      <div className="mt-2 overflow-hidden rounded-3xl bg-white/[0.02] ring-1 ring-white/[0.07]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3.5 last:border-0">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-white/[0.06]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-28 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-3 w-20 animate-pulse rounded bg-white/[0.04]" />
            </div>
            <div className="shrink-0 space-y-2 text-right">
              <div className="h-3.5 w-16 animate-pulse rounded bg-white/[0.06]" />
              <div className="ml-auto h-4 w-20 animate-pulse rounded-full bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}