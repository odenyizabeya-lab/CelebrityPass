"use client";

import { useState } from "react";
import {
  HARD_MIN,
  HARD_MAX,
  money,
  readFileAsDataUrl,
  postDepositIntent,
  postDepositProof,
  type DepositIntent,
  type BankAccount,
} from "./depositShared";

/**
 * The ATM Deposit flow — completely separate from Bank Transfer. Shows the
 * admin-configured ATM/payment instructions, the destination account, takes an
 * ATM transaction/reference number and an ATM receipt photo, and always lands
 * in PENDING until an admin verifies the ATM transaction.
 */
export default function AtmDeposit() {
  const [amount, setAmount] = useState("1000");
  const [stage, setStage] = useState<"amount" | "pay" | "upload" | "done">("amount");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<DepositIntent | null>(null);
  const [senderName, setSenderName] = useState("");
  const [atmRef, setAtmRef] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const amountError = (() => {
    const v = Number(amount);
    if (!amount || Number.isNaN(v) || v < HARD_MIN || v > HARD_MAX) {
      return `Enter an amount between $${money(HARD_MIN)} and $${money(HARD_MAX)}.`;
    }
    return null;
  })();

  async function startDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (amountError) return;
    setBusy(true);
    setError(null);
    try {
      const data = await postDepositIntent(amount, "atm-deposit");
      if (!data.depositRef) throw new Error("The payment could not be started. Please try again.");
      setIntent(data);
      setStage("pay");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!intent) return;
    if (!file) {
      setError("Attach a photo of your ATM deposit slip/receipt.");
      return;
    }
    if (!atmRef.trim()) {
      setError("Enter the ATM transaction/reference number printed on the slip.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (dataUrl.length > 2_500_000) throw new Error("That image is too large (max ~1.9 MB).");
      await postDepositProof({
        txnId: intent.pendingTxnId,
        method: "atm-deposit",
        amountCents: Math.round(Number(intent.amount) * 100),
        senderName,
        reference: atmRef.trim(),
        transferDate: transferDate || undefined,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        fileUrl: dataUrl,
      });
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "pay" && intent) {
    return (
      <div className="mt-4 space-y-3">
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Step 2 — Deposit by ATM</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Deposit cash of <span className="font-black text-white">{money(Number(intent.amount))} USD</span> at any ATM
            into the account below and keep the ATM receipt — it shows your ATM transaction/reference number.
          </p>
        </div>
        <div className="space-y-2">
          <CopyRow label="ATM deposit reference (note on the slip)" value={intent.depositRef} />
          {intent.bankAccount ? (
            <>
              <CopyRow label="Bank" value={intent.bankAccount.bankName} />
              <CopyRow label="Beneficiary" value={intent.bankAccount.beneficiary} />
              <CopyRow label="Account number" value={intent.bankAccount.accountNumber} />
              <CopyRow label="Routing / Sort code" value={intent.bankAccount.routing ?? intent.bankAccount.sortCode} />
              <CopyRow label="Bank address" value={intent.bankAccount.countryName} />
            </>
          ) : (
            <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300">ATM deposit details are not configured yet.</p>
          )}
        </div>
        {intent.atmInstructions ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">How to deposit</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{intent.atmInstructions}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStage("upload")}
            disabled={!intent.bankAccount}
            className="btn-grad rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            I&apos;ve deposited — upload ATM slip
          </button>
          <button
            onClick={() => {
              setStage("amount");
              setIntent(null);
              setError(null);
            }}
            className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-bold text-zinc-300 hover:bg-white/5"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (stage === "upload" && intent) {
    return (
      <form onSubmit={submitReceipt} className="mt-4 space-y-3">
        <label className="block text-sm text-zinc-400">
          ATM transaction / reference number <span className="text-zinc-600">(required — printed on the ATM slip)</span>
          <input value={atmRef} onChange={(e) => setAtmRef(e.target.value)} placeholder="e.g. 49210987" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-zinc-400">
            Depositor name (optional)
            <input value={senderName} onChange={(e) => setSenderName(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500" />
          </label>
          <label className="block text-sm text-zinc-400">
            Deposit date
            <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500" />
          </label>
        </div>
        <label className="block text-sm text-zinc-400">
          ATM receipt image (photo/screenshot)
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-300 file:mr-3 file:rounded-full file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
          />
          {file && <span className="mt-1 block text-xs text-zinc-500">{file.name} · {(file.size / 1024).toFixed(0)} KB</span>}
        </label>
        {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="btn-grad rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {busy ? "Submitting…" : "Submit ATM receipt"}
          </button>
          <button type="button" onClick={() => setStage("pay")} className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-bold text-zinc-300 hover:bg-white/5">
            Back
          </button>
        </div>
      </form>
    );
  }

  if (stage === "done") {
    return (
      <div className="mt-4 rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.06] p-5 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
          <svg className="h-6 w-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="mt-3 font-bold text-white">ATM receipt submitted</p>
        <p className="mt-1 text-sm text-zinc-400">
          Pending verification. Your funds are credited the moment our team confirms the ATM transaction.
        </p>
        <p className="mt-3 font-mono text-xs text-zinc-500">Deposit {intent?.depositRef}</p>
      </div>
    );
  }

  return (
    <form onSubmit={startDeposit} className="mt-4 space-y-3">
      <label className="block text-sm text-zinc-400">
        Amount (USD)
        <input
          type="number"
          min={HARD_MIN}
          max={HARD_MAX}
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500"
        />
      </label>
      <p className="text-xs text-zinc-500">
        Minimum ${money(HARD_MIN)} · maximum ${money(HARD_MAX)}. Deposit cash at an ATM — no card fees.
      </p>
      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>}
      <button type="submit" disabled={busy || !!amountError} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {busy ? "Processing…" : "Deposit by ATM"}
      </button>
    </form>
  );
}

function CopyRow({ label, value }: { label: string; value?: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* copy is a nicety */
        }
      }}
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-ink-800/60 px-3 py-2.5 text-left transition hover:border-white/25"
      title="Tap to copy"
    >
      <span>
        <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
        <span className="block font-mono text-sm text-white">{value}</span>
      </span>
      <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-zinc-300 ring-1 ring-white/10">
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}