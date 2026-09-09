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

type Row = { label: string; value: string; copyable: boolean; mono: boolean };

const MONO_LABELS = new Set([
  "Account number",
  "IBAN",
  "SWIFT / BIC",
  "Routing (ABA)",
  "Sort code",
  "Institution number",
  "Transit number",
  "Branch code",
  "Bank code",
]);

/** Build ordered, labelled rows for the account, skipping unset fields. */
function buildRows(acct: PublicBankAccount): Row[] {
  const rows: Row[] = [];
  const push = (label: string, value: string | null | undefined, copyable = true) => {
    if (value && value.trim()) rows.push({ label, value: value.trim(), copyable, mono: MONO_LABELS.has(label) });
  };
  push("Beneficiary name", acct.beneficiary);
  push("Bank name", acct.bankName, false);
  push("Account type", acct.accountType);
  push("Account number", acct.accountNumber);
  push("IBAN", acct.iban);
  push("SWIFT / BIC", acct.swift || acct.bic);
  push("Routing (ABA)", acct.routing);
  push("Sort code", acct.sortCode);
  push("Institution number", acct.institutionNumber);
  push("Transit number", acct.transitNumber);
  push("Branch code", acct.branchCode);
  push("Bank code", acct.bankCode);
  push("Bank address", acct.bankAddress, true);
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

function RowIcon({ label }: { label: string }) {
  const cls = "h-[18px] w-[18px] text-emerald-300";
  switch (label) {
    case "Beneficiary name":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      );
    case "Bank name":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
      );
    case "Account type":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path d="M6 6h.008v.008H6V6z" />
        </svg>
      );
    case "IBAN":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      );
    case "SWIFT / BIC":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m-17.432 0A8.959 8.959 0 013 12c0-1.229.192-2.406.543-3.531" />
        </svg>
      );
    case "Routing (ABA)":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
        </svg>
      );
    case "Bank address":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={cls}>
          <path d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-6.6-19.5l-3.9 19.5" />
        </svg>
      );
  }
}

export default function BankAccountCard({ account }: { account: PublicBankAccount }) {
  const { copied, copy } = useCopy();
  const rows = buildRows(account);
  const ref = `FC-${account.id.slice(-6).toUpperCase()}`;

  return (
    <div className="overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-white/[0.07] to-white/[0.02]">
      {/* Bank-app-style header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-emerald-500/10 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500 text-xl font-black text-emerald-900 shadow-lg shadow-emerald-500/20">
            {account.bankName.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-black text-white">{account.bankName}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">
              {account.countryFlag ? `${account.countryFlag} ` : ""}
              {account.countryName} · {account.currency}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
          {account.transferType}
        </span>
      </div>

      {/* Bank details */}
      <div className="divide-y divide-white/5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <RowIcon label={r.label} />
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{r.label}</p>
              </div>
              <p
                className={`mt-1.5 text-[17px] font-semibold leading-snug text-white ${
                  r.mono ? "font-mono tracking-wide" : "break-words"
                }`}
              >
                {r.value}
              </p>
            </div>
            {r.copyable && (
              <button
                type="button"
                onClick={() => copy(r.label, r.value)}
                className={`shrink-0 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
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

      {/* Transfer reference */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-emerald-500/[0.06] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300/70">Your transfer reference</p>
            <p className="font-mono text-lg font-black tracking-wide text-white">{ref}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => copy("Reference", ref)}
          className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-bold transition ${
            copied === "Reference"
              ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
              : "border-white/15 bg-white/5 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-300"
          }`}
        >
          {copied === "Reference" ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="border-t border-white/5 px-5 py-3 text-xs leading-relaxed text-zinc-500 sm:px-6">
        Use the reference above on your transfer so we can match the payment to your order. Keep the full reference — do not shorten it.
      </p>
    </div>
  );
}