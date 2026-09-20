"use client";

import { useState } from "react";
import { formatUSD, readFileAsDataUrl, postDepositProof, type DepositIntent } from "./depositShared";

/**
 * Dedicated ATM Deposit flow. Receives an already-created intent (amount, ATM
 * deposit reference, destination account, admin-configured ATM instructions)
 * and walks the investor through the instructions → receipt upload → PENDING.
 */
export default function AtmDeposit({
  intent,
  onBack,
  onDone,
}: {
  intent: DepositIntent;
  onBack: () => void;
  onDone?: () => void;
}) {
  const [step, setStep] = useState<"pay" | "done">("pay");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atmRef, setAtmRef] = useState("");
  const [senderName, setSenderName] = useState("");
  const [depositedOn, setDepositedOn] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const amount = Number(intent.amount);
  const account = intent.bankAccount;
  const instructions = intent.atmInstructions?.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!atmRef.trim()) {
      setError("Enter the ATM transaction / reference number printed on the slip.");
      return;
    }
    if (!file) {
      setError("Choose a photo of your ATM deposit receipt.");
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
        amountCents: Math.round(amount * 100),
        senderName,
        reference: atmRef.trim(),
        transferDate: depositedOn || undefined,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        fileUrl: dataUrl,
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not submit your receipt. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <div className="space-y-4">
        <BackHeader onBack={onBack} label="ATM Deposit" />
        <div className="rounded-3xl bg-gradient-to-b from-emerald-500/12 to-emerald-500/[0.02] p-6 text-center ring-1 ring-emerald-400/25">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40">
            <svg className="h-9 w-9 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="mt-4 text-[20px] font-black text-white">Deposit submitted</p>
          <p className="mt-1 text-[15px] font-bold text-zinc-300">{formatUSD(amount)}</p>
          <p className="mt-1 font-mono text-[12px] text-zinc-500">{intent.depositRef}</p>

          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-2 text-[12px] font-black uppercase tracking-[0.15em] text-amber-300 ring-1 ring-amber-400/30">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            Pending verification
          </span>

          <p className="mt-4 text-[13px] leading-6 text-zinc-400">
            Your balance is only credited after our team verifies the ATM deposit. This deposit stays{" "}
            <span className="font-bold text-white">PENDING</span> until it is confirmed, then moves to{" "}
            <span className="font-bold text-emerald-400">COMPLETED</span>.
          </p>

          <button
            onClick={onDone}
            className="btn-grad mt-5 w-full rounded-2xl py-4 text-[16px] font-black text-white shadow-xl shadow-primary-600/25 active:scale-[0.99]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackHeader onBack={onBack} label="ATM Deposit" />

      <div className="rounded-3xl bg-white/[0.03] p-5 text-center ring-1 ring-white/[0.08]">
        <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Amount</p>
        <p className="mt-1 text-[32px] font-black text-white">{formatUSD(amount)}</p>
      </div>

      {instructions && (
        <section className="rounded-3xl bg-gradient-to-b from-emerald-500/10 to-emerald-500/[0.02] p-5 ring-1 ring-emerald-400/25">
          <p className="text-[13px] font-black uppercase tracking-[0.18em] text-emerald-300">How to deposit</p>
          <p className="mt-2 whitespace-pre-line text-[14px] leading-7 text-zinc-200">{instructions}</p>
        </section>
      )}

      <section className="rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/[0.08]">
        <p className="text-[13px] font-black uppercase tracking-[0.18em] text-primary-300">Deposit to this account</p>
        <dl className="mt-3 space-y-3">
          <DetailRow label="Bank" value={account?.bankName ?? "—"} />
          <DetailRow label="Account name" value={account?.beneficiary ?? "—"} />
          <DetailRow label="Account number" value={account?.accountNumber ?? account?.iban ?? "—"} />
          <DetailRow label="ATM deposit reference" value={intent.depositRef} mono />
        </dl>
      </section>

      <form onSubmit={submit} className="space-y-4">
        <section className="rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/[0.08]">
          <p className="text-[13px] font-black uppercase tracking-[0.18em] text-zinc-300">ATM transaction / reference number</p>
          <p className="mt-1 text-[12px] text-zinc-500">Printed on the ATM receipt you received.</p>
          <input
            value={atmRef}
            onChange={(e) => setAtmRef(e.target.value)}
            placeholder="e.g. 49210987"
            className="mt-3 w-full rounded-2xl border border-white/10 bg-ink-950 px-4 py-3.5 text-[16px] text-white outline-none transition focus:border-emerald-400"
          />
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="text-[11px] font-semibold text-zinc-500">Depositor name (optional)</span>
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 text-[14px] text-white outline-none focus:border-emerald-400"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-zinc-500">Deposit date</span>
              <input
                type="date"
                value={depositedOn}
                onChange={(e) => setDepositedOn(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 text-[14px] text-white outline-none focus:border-emerald-400"
              />
            </label>
          </div>
        </section>

        <section className="rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/[0.08]">
          <p className="text-[13px] font-black uppercase tracking-[0.18em] text-zinc-300">Upload ATM receipt</p>
          <label className="mt-3 flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] py-6 text-center transition hover:border-emerald-400/50">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="text-3xl">🏧</span>
            <span className="mt-2 text-[14px] font-bold text-white">{file ? file.name : "Choose Receipt"}</span>
            {file && <span className="mt-0.5 text-[11px] text-zinc-500">{(file.size / 1024).toFixed(0)} KB — tap to change</span>}
          </label>
        </section>

        {error && (
          <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/30">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="btn-grad w-full rounded-2xl py-4 text-[16px] font-black tracking-wide text-white shadow-xl shadow-primary-600/25 transition active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? "Submitting…" : "SUBMIT ATM DEPOSIT"}
        </button>
      </form>
    </div>
  );
}

function BackHeader({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <button
        aria-label="Back"
        onClick={onBack}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.05] text-zinc-300 ring-1 ring-white/10 transition active:scale-90 hover:bg-white/[0.1]"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <p className="text-[17px] font-black tracking-wide text-white">{label}</p>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.08]">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={`break-all text-right text-[14px] font-bold ${mono ? "font-mono" : ""} text-white`}>{value}</span>
    </div>
  );
}