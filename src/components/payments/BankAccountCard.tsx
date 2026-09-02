"use client";

import { useState } from "react";

type PublicBankAccount = {
  id: string;
  currency: string;
  countryName: string;
  countryFlag: string | null;
  beneficiary: string;
  bankName: string;
  accountType: string | null;
  accountNumber: string | null;
  iban: string | null;
  bic: string | null;
  swift: string | null;
  routing: string | null;
  sortCode: string | null;
  institutionNumber: string | null;
  transitNumber: string | null;
  branchCode: string | null;
  bankCode: string | null;
  transferType: string;
  bankAddress: string | null;
};

/** Build ordered, labelled rows for the account, skipping unset fields. */
function buildRows(acct: PublicBankAccount): { label: string; value: string; copyable?: boolean }[] {
  const rows: { label: string; value: string; copyable?: boolean }[] = [];
  const push = (label: string, value: string | null | undefined, copyable = true) => {
    if (value && value.trim()) rows.push({ label, value: value.trim(), copyable });
  };
  push("Beneficiary", acct.beneficiary, true);
  push("Bank", acct.bankName, false);
  push("Account number", acct.accountNumber);
  push("IBAN", acct.iban);
  push("SWIFT / BIC", acct.swift || acct.bic);
  push("Routing (ABA)", acct.routing);
  push("Sort code", acct.sortCode);
  push("Institution number", acct.institutionNumber);
  push("Transit number", acct.transitNumber);
  push("Branch code", acct.branchCode);
  push("Bank code", acct.bankCode);
  push("Address", acct.bankAddress, false);
  return rows;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    const done = () => {
      setCopied(key);
      setTimeout(() => setCopied((v) => (v === key ? null : v)), 1800);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
      done();
    }
  };
  return { copied, copy };
}

export default function BankAccountCard({ account }: { account: PublicBankAccount }) {
  const { copied, copy } = useCopy();
  const rows = buildRows(account);

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-white/[0.06] to-white/[0.02]">
      {/* Bank-app-style header strip */}
      <div className="flex items-center justify-between border-b border-white/10 bg-emerald-500/10 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500 text-lg font-black text-emerald-900">
            {account.bankName.slice(0, 1)}
          </div>
          <div>
            <p className="text-sm font-bold text-white">{account.bankName}</p>
            <p className="text-[11px] uppercase tracking-wider text-emerald-300/80">
              {account.countryFlag ? `${account.countryFlag} ` : ""}
              {account.countryName} · {account.currency}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
          {account.transferType}
        </span>
      </div>

      <div className="divide-y divide-white/5 px-5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">{r.label}</p>
              <p className="truncate font-mono text-[15px] font-semibold text-white">{r.value}</p>
            </div>
            {r.copyable && (
              <button
                type="button"
                onClick={() => copy(r.label, r.value)}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                  copied === r.label
                    ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                    : "border-white/15 bg-white/5 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-300"
                }`}
              >
                {copied === r.label ? "Copied" : "Copy"}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 bg-white/[0.03] px-5 py-3 text-[11px] text-zinc-400">
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 font-mono text-zinc-300">Ref: {`FC-${account.id.slice(-6).toUpperCase()}`}</span>
        <span className="truncate">Use this reference on your transfer so we can match it to you.</span>
      </div>
    </div>
  );
}