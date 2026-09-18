"use client";

import { useState } from "react";

const HARD_MIN = 100;
const HARD_MAX = 15_000_000;

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export default function SubscribeForm({
  opportunityId,
  minAmount,
  maxAmount,
  currency,
}: {
  opportunityId: string;
  slug: string;
  minAmount: number | null;
  maxAmount: number | null;
  currency: string;
}) {
  const [amount, setAmount] = useState(String(Math.max(HARD_MIN, minAmount ?? HARD_MIN)));
  const [stage, setStage] = useState<"amount" | "pay" | "upload" | "done">("amount");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<{ pendingTxnId: string; depositRef: string; amount: string; bankAccount: BankAccount | null } | null>(null);
  const [senderName, setSenderName] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const lo = Math.max(HARD_MIN, minAmount ?? HARD_MIN);
  const hi = Math.min(HARD_MAX, maxAmount ?? HARD_MAX);

  const amountError = (() => {
    const v = Number(amount);
    if (!amount || Number.isNaN(v) || v < lo || v > hi) return `Enter an amount between $${money(lo)} and $${money(hi)}.`;
    return null;
  })();

  async function startDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (amountError) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invest/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, opportunityId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start your payment. Please try again.");
      if (!data.pendingTxnId || !data.depositRef) throw new Error("The payment could not be started. Please try again.");
      setIntent({ pendingTxnId: data.pendingTxnId, depositRef: data.depositRef, amount: data.amount ?? amount, bankAccount: data.bankAccount });
      setStage("pay");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!intent) return;
    if (!file) {
      setError("Attach a photo/screenshot of your ATM slip or transfer receipt.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let fileUrl = "";
      let mimeType = "";
      let fileName = "";
      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (dataUrl.length > 2_500_000) throw new Error("That image is too large (max ~1.9 MB).");
        fileUrl = dataUrl;
        mimeType = file.type || "image/jpeg";
        fileName = file.name;
      } catch (readErr) {
        throw readErr instanceof Error ? readErr : new Error("Could not read the receipt file.");
      }

      const res = await fetch(`/api/invest/deposits/${intent.pendingTxnId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: Math.round(Number(intent.amount) * 100),
          currency,
          senderName,
          reference: transferRef,
          transferDate: transferDate || null,
          fileName,
          mimeType,
          fileUrl,
          opportunityId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "We could not submit your receipt. Please try again.");
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* copy is a nicety */
    }
  }

  function CopyRow({ label, value }: { label: string; value?: string | null }) {
    if (!value) return null;
    return (
      <button
        type="button"
        onClick={() => copy(value)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-ink-800/60 px-3 py-2.5 text-left transition hover:border-white/25"
        title="Tap to copy"
      >
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
          <span className="block font-mono text-sm text-white">{value}</span>
        </span>
        <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-zinc-300 ring-1 ring-white/10">
          {copied === value ? "Copied" : "Copy"}
        </span>
      </button>
    );
  }

  if (stage === "pay" && intent) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Pay by bank transfer / ATM</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Transfer <span className="font-black text-white">${money(Number(intent.amount))} {currency}</span> to the
            account below and quote your deposit reference so we can match it to you.
          </p>
        </div>
        <div className="space-y-2">
          <CopyRow label="Deposit reference (use on your transfer)" value={intent.depositRef} />
          {intent.bankAccount ? (
            <>
              <CopyRow label="Bank" value={intent.bankAccount.bankName} />
              <CopyRow label="Beneficiary" value={intent.bankAccount.beneficiary} />
              <CopyRow label="Account number" value={intent.bankAccount.accountNumber} />
              <CopyRow label="IBAN" value={intent.bankAccount.iban} />
              <CopyRow label="SWIFT / BIC" value={intent.bankAccount.swift} />
              <CopyRow label="Routing / Sort code" value={intent.bankAccount.routing ?? intent.bankAccount.sortCode} />
            </>
          ) : (
            <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300">Bank details are not configured yet.</p>
          )}
        </div>
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
      <form onSubmit={submitReceipt} className="space-y-3">
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
          Receipt image
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
      <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.06] p-5 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
          <svg className="h-6 w-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="mt-3 font-bold text-white">Receipt submitted</p>
        <p className="mt-1 text-sm text-zinc-400">
          Pending manual verification. Your investment is credited once the real bank transfer is confirmed.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={startDeposit} className="space-y-3">
      <label className="block text-sm text-zinc-400">
        Amount ({currency})
        <input
          type="number"
          min={lo}
          max={hi}
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500"
        />
      </label>
      <p className="text-xs text-zinc-500">Range ${money(lo)} – ${money(hi)} · paid by bank transfer or ATM.</p>
      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>}
      <button type="submit" disabled={busy || !!amountError} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {busy ? "Processing…" : "Pay by bank transfer / ATM"}
      </button>
    </form>
  );
}

type BankAccount = {
  id: string;
  currency: string;
  countryName: string;
  beneficiary: string;
  bankName: string;
  accountType: string | null;
  accountNumber: string | null;
  iban: string | null;
  swift: string | null;
  routing: string | null;
  sortCode: string | null;
  bankCode: string | null;
  transferType: string | null;
};