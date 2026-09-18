"use client";

import { useMemo, useState } from "react";

export type CelebrityOpp = {
  id: string;
  slug: string;
  name: string;
  companyName: string | null;
  description: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  raisedAmount: number;
  currency: string;
};

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

type Intent = {
  pendingTxnId: string;
  depositRef: string;
  amount: string;
  bankAccount: BankAccount | null;
};

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

export default function CelebrityInvestWidget({ celebrityName, opportunities }: { celebrityName: string; opportunities: CelebrityOpp[] }) {
  const [oppIndex, setOppIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<"pick" | "pay" | "upload" | "done" | "pending">("pick");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [senderName, setSenderName] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const opp = opportunities[oppIndex];

  const bounds = useMemo(() => {
    const lo = Math.max(HARD_MIN, opp?.minAmount ?? HARD_MIN);
    const hi = Math.min(HARD_MAX, opp?.maxAmount ?? HARD_MAX);
    return { lo, hi };
  }, [opp]);

  const amountError = useMemo(() => {
    const v = Number(amount);
    if (!amount || Number.isNaN(v)) return `Enter an amount between $${money(bounds.lo)} and $${money(bounds.hi)}.`;
    if (v < bounds.lo) return `Minimum investment is $${money(bounds.lo)}.`;
    if (v > bounds.hi) return `Maximum investment is $${money(bounds.hi)}.`;
    return null;
  }, [amount, bounds]);

  if (!opp) return null;

  async function startPayment(e: React.FormEvent) {
    e.preventDefault();
    if (amountError || Number(amount) <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invest/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, opportunityId: opp.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start your deposit. Please try again.");
      if (!data.pendingTxnId || !data.depositRef) throw new Error("The payment could not be started. Please try again.");
      setIntent({
        pendingTxnId: data.pendingTxnId,
        depositRef: data.depositRef,
        amount: data.amount ?? amount,
        bankAccount: data.bankAccount,
      });
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

      const amountCents = Math.round(Number(intent.amount) * 100);
      const res = await fetch(`/api/invest/deposits/${intent.pendingTxnId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          currency: "USD",
          senderName,
          reference: transferRef,
          transferDate: transferDate || null,
          fileName,
          mimeType,
          fileUrl,
          opportunityId: opp.id,
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
      /* clipboard may be unavailable — copying is a nicety */
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
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Step 2 — Pay by Bank Transfer / ATM</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Transfer <span className="font-black text-white">${money(Number(intent.amount))} USD</span> to the bank account
            below from any bank app or ATM. Put your <span className="font-black text-white">deposit reference</span> in the
            transfer note so we can match it to you.
          </p>
        </div>

        <div className="space-y-2.5">
          <CopyRow label="Deposit reference (use this on your transfer)" value={intent.depositRef} />
          {intent.bankAccount ? (
            <>
              <CopyRow label="Bank" value={intent.bankAccount.bankName} />
              <CopyRow label="Beneficiary name" value={intent.bankAccount.beneficiary} />
              <CopyRow label="Account number" value={intent.bankAccount.accountNumber} />
              <CopyRow label="IBAN" value={intent.bankAccount.iban} />
              <CopyRow label="SWIFT / BIC" value={intent.bankAccount.swift} />
              <CopyRow label="Routing / Sort code" value={intent.bankAccount.routing ?? intent.bankAccount.sortCode} />
              <CopyRow label="Account type" value={intent.bankAccount.accountType} />
            </>
          ) : (
            <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              Bank details are not configured yet — the platform team will enable them shortly.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStage("upload")}
            disabled={!intent.bankAccount || busy}
            className="btn-grad rounded-full px-6 py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            I&apos;ve paid — upload receipt
          </button>
          <button
            onClick={() => {
              setStage("pick");
              setIntent(null);
              setError(null);
            }}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/5"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (stage === "upload" && intent) {
    return (
      <form onSubmit={submitReceipt} className="space-y-4">
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Step 3 — Upload your receipt</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Attach a clear photo or screenshot of your ATM slip / bank transfer receipt showing the amount and your
            deposit reference <span className="font-mono font-bold text-white">{intent.depositRef}</span>. Our team verifies
            it against the real bank statement before crediting you.
          </p>
        </div>

        <label className="block text-sm text-zinc-400">
          Name on the transfer
          <input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="e.g. John Doe"
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-zinc-400">
            Transfer reference / note (optional)
            <input
              value={transferRef}
              onChange={(e) => setTransferRef(e.target.value)}
              placeholder="The note you wrote on the transfer"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            Transfer date
            <input
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500"
            />
          </label>
        </div>

        <label className="block text-sm text-zinc-400">
          Receipt image (photo of ATM slip or transfer)
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
          <button
            type="submit"
            disabled={busy}
            className="btn-grad rounded-full px-6 py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit receipt"}
          </button>
          <button
            type="button"
            onClick={() => setStage("pay")}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/5"
          >
            Back
          </button>
        </div>
      </form>
    );
  }

  if (stage === "done") {
    return (
      <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.06] p-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
          <svg className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="mt-4 text-xl font-black text-white">Receipt submitted</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-300">
          Your deposit is now <span className="font-bold text-white">pending verification</span>. We will confirm your
          transaction against the real bank statement and credit your investment the moment it checks out — usually
          within hours on business days.
        </p>
        <p className="mt-4 font-mono text-xs text-zinc-500">Deposit {intent?.depositRef}</p>
      </div>
    );
  }

  // pick stage
  return (
    <form onSubmit={startPayment} className="space-y-4">
      {opportunities.length > 1 && (
        <label className="block text-sm text-zinc-400">
          Select an investment
          <select
            value={oppIndex}
            onChange={(e) => {
              setOppIndex(Number(e.target.value));
              setAmount("");
            }}
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500"
          >
            {opportunities.map((o, i) => (
              <option key={o.id} value={i}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-white">
            Invest in {opp.name}
            {opp.companyName ? <span className="ml-1.5 font-normal text-zinc-400">· {opp.companyName}</span> : null}
          </p>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-400/20">
            Open
          </span>
        </div>
        {opp.description && <p className="mt-2 text-sm leading-relaxed text-zinc-400">{opp.description}</p>}
        <p className="mt-3 text-xs text-zinc-500">
          Invested so far: <span className="font-bold text-zinc-200">${money(opp.raisedAmount)}</span> · Range:{" "}
          <span className="font-bold text-zinc-200">
            ${money(bounds.lo)} – ${money(bounds.hi)}
          </span>
        </p>
      </div>

      <label className="block text-sm text-zinc-400">
        Investment amount (USD)
        <input
          type="number"
          min={bounds.lo}
          max={bounds.hi}
          step="0.01"
          required
          placeholder={`${money(bounds.lo)} – ${money(bounds.hi)}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-lg font-black text-white outline-none focus:border-primary-500"
        />
      </label>
      {amountError && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{amountError}</p>}

      <ul className="space-y-1.5 text-sm text-zinc-400">
        <li className="flex items-start gap-2">
          <span className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400">✓</span>
          Pay from any bank app or ATM — no card fees.
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400">✓</span>
          Upload your receipt; our team verifies the real transfer.
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400">✓</span>
          Nothing is credited until your bank transfer is confirmed.
        </li>
      </ul>

      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>}

      <button
        type="submit"
        disabled={busy || !!amountError}
        className="btn-grad w-full rounded-full px-6 py-3.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "Preparing…" : `Continue to payment · $${amount && !amountError ? money(Number(amount)) : "—"}`}
      </button>
      <p className="text-center text-xs text-zinc-600">Investments start at $100 · {celebrityName}'s verified opportunity</p>
    </form>
  );
}