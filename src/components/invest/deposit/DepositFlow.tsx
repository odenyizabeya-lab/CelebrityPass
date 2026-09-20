"use client";

import { useState } from "react";
import BankTransferDeposit from "./BankTransferDeposit";
import AtmDeposit from "./AtmDeposit";

export type MethodKey = "bank-transfer" | "atm-deposit";

const METHODS: { key: MethodKey; name: string; tagline: string; icon: string }[] = [
  { key: "bank-transfer", name: "Manual Bank Transfer", tagline: "Transfer from any bank", icon: "🏦" },
  { key: "atm-deposit", name: "ATM Deposit", tagline: "Deposit cash at an ATM", icon: "🏧" },
];

/**
 * Landing picker: a deposit always belongs to exactly ONE method, and the
 * selected method opens ONLY that method's flow. No combined form exists.
 */
export default function DepositFlow() {
  const [selected, setSelected] = useState<MethodKey | null>(null);

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {METHODS.map((m) => (
          <button
            key={m.key}
            onClick={() => setSelected(m.key)}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-primary-500/60 hover:bg-white/[0.06]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xl">{m.icon}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-zinc-400 transition group-hover:border-primary-500/60 group-hover:text-primary-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
            <p className="mt-3 font-bold text-white">{m.name}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{m.tagline}</p>
          </button>
        ))}
      </div>
      {selected && (
        <div className="mt-4">
          <button
            onClick={() => setSelected(null)}
            className="mb-2 flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-300"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to payment methods
          </button>
          {selected === "bank-transfer" ? <BankTransferDeposit /> : <AtmDeposit />}
        </div>
      )}
    </>
  );
}