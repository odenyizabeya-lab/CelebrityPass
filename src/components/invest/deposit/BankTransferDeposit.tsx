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

/** The Manual Bank Transfer deposit flow — completely separate from ATM. */
export default function BankTransferDeposit() {
  const [amount, setAmount] = useState("1000");
  const [stage, setStage] = useState<"amount" | "pay" | "upload" | "done">("amount");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<DepositIntent | null>(null);
  const [senderName, setSenderName] = useState("");
  const [transferRef, setTransferRef] = useState("");
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
      const data = await postDepositIntent(amount, "bank-transfer");
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
      setError("Attach a photo/screenshot of your bank transfer receipt.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (dataUrl.length > 2_500_000) throw new Error("That image is too large (max ~1.9 MB).");
      await postDepositProof({
        txnId: intent.pendingTxnId,
        method: "bank-transfer",
        amountCents: Math.round(Number(intent.amount) * 100),
        senderName,
        reference: transferRef,
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
        <div className="rounded-2xl border border-sky-400/30 bg-sky-400/[0.06] p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">Step 2 — Pay by Bank Transfer</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Transfer <span className="font-black text-white">{money(Number(intent.amount))} USD</span> to the account
            below and quote your deposit reference so we can match it to you.
          </p>
        </div>
        <BankCopyRows account={intent.bankAccount} depositRef={intent.depositRef} />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStage("upload")}
            disabled={!intent.bankAccount}
            className="btn-grad rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            I&apos;ve paid — upload receipt
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
          Name on the transfer
          <input value={senderName} onChange={(e) => setSenderName(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-zinc-400">
            Reference / note (optional)
            <input value={transferRef} onChange={(e) => setTransferRef(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500" />
          </label>
          <label className="block text-sm text-zinc-400">
            Transfer date
            <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500" />
          </label>
        </div>
        <label className="block text-sm text-zinc-400">
          Receipt image (transfer screenshot)
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
            {busy ? "Submitting…" : "Submit receipt"}
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
        <p className="mt-3 font-bold text-white">Receipt submitted</p>
        <p className="mt-1 text-sm text-zinc-400">
          Pending verification. Your funds are credited the moment our team confirms the real bank transfer.
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
        Minimum ${money(HARD_MIN)} · maximum ${money(HARD_MAX)}. Paid by bank transfer — no card fees.
      </p>
      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>}
      <button type="submit" disabled={busy || !!amountError} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {busy ? "Processing…" : "Deposit by Bank Transfer"}
      </button>
    </form>
  );
}

function BankCopyRows({ account, depositRef }: { account: BankAccount | null; depositRef?: string | null }) {
  if (depositRef) {
    return (
      <div className="space-y-2">
        <CopyRow label="Deposit reference (use on your transfer)" value={depositRef} />
        {account ? (
          <>
            <CopyRow label="Bank" value={account.bankName} />
            <CopyRow label="Beneficiary" value={account.beneficiary} />
            <CopyRow label="Account number" value={account.accountNumber} />
            <CopyRow label="IBAN" value={account.iban} />
            <CopyRow label="SWIFT / BIC" value={account.swift} />
            <CopyRow label="Routing / Sort code" value={account.routing ?? account.sortCode} />
          </>
        ) : (
          <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300">Bank details are not configured yet.</p>
        )}
      </div>
    );
  }
  return <div className="space-y-2" />;
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