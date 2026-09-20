"use client";

import { useMemo, useState } from "react";
import { formatUSD, readFileAsDataUrl, postDepositProof, copyText, type DepositIntent, type BankAccount } from "./depositShared";

/** Big "HOW TO MAKE YOUR BANK TRANSFER" advice shown before the account details. */
function BankTransferAdvice() {
  return (
    <section className="rounded-3xl bg-gradient-to-b from-sky-500/10 to-sky-500/[0.02] p-5 ring-1 ring-sky-400/25">
      <p className="text-[13px] font-black uppercase tracking-[0.18em] text-sky-300">How to make your bank transfer</p>
      <p className="mt-2 text-[13px] leading-6 text-zinc-300">You can make your payment in either of these ways:</p>

      <div className="mt-3 space-y-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-xl ring-1 ring-white/10">🏦</span>
          <div>
            <p className="text-[14px] font-black text-white">Visit your bank</p>
            <p className="mt-0.5 text-[13px] leading-6 text-zinc-400">
              Go to your bank branch and make the transfer using the bank details provided below. After completing the
              payment, keep your receipt and upload a clear photo/PDF of the transaction receipt.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-xl ring-1 ring-white/10">📱</span>
          <div>
            <p className="text-[14px] font-black text-white">Use mobile / phone banking</p>
            <p className="mt-0.5 text-[13px] leading-6 text-zinc-400">
              You can also make the transfer directly from your phone using your bank&apos;s mobile banking app. After the
              transaction is successful, save the transaction receipt/reference and upload it here.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
        <p className="text-[12px] font-black uppercase tracking-[0.15em] text-amber-300">Important</p>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-6 text-zinc-300">
          <li>• Make sure you transfer the exact amount you entered.</li>
          <li>• Make sure the account details are correct before sending.</li>
          <li>• Keep your payment receipt / transaction reference.</li>
          <li>• Your deposit will remain PENDING until the payment is verified.</li>
          <li>• Your balance will only be credited after the payment has been successfully verified.</li>
        </ul>
      </div>
    </section>
  );
}

/** Fields of the exact admin-configured account (only the ones actually stored). */
function accountRows(account: BankAccount): { label: string; value: string; mono?: boolean }[] {
  const rows: { label: string; value: string; mono?: boolean }[] = [];
  rows.push({ label: "Country", value: account.countryName });
  rows.push({ label: "Currency", value: account.currency });
  if (account.beneficiary) rows.push({ label: "Account name", value: account.beneficiary });
  if (account.bankName) rows.push({ label: "Bank name", value: account.bankName });
  if (account.accountType) rows.push({ label: "Account type", value: account.accountType });
  if (account.accountNumber) rows.push({ label: "Account number", value: account.accountNumber, mono: true });
  if (account.iban) rows.push({ label: "IBAN", value: account.iban, mono: true });
  if (account.bic) rows.push({ label: "BIC", value: account.bic, mono: true });
  if (account.swift) rows.push({ label: "SWIFT", value: account.swift, mono: true });
  if (account.routing) rows.push({ label: "Routing number", value: account.routing, mono: true });
  if (account.sortCode) rows.push({ label: "Sort code", value: account.sortCode, mono: true });
  if (account.institutionNumber) rows.push({ label: "Institution number", value: account.institutionNumber, mono: true });
  if (account.transitNumber) rows.push({ label: "Transit number", value: account.transitNumber, mono: true });
  if (account.branchCode) rows.push({ label: "Branch code", value: account.branchCode, mono: true });
  if (account.bankCode) rows.push({ label: "Bank code", value: account.bankCode, mono: true });
  if (account.transferType) rows.push({ label: "Transfer type", value: account.transferType });
  if (account.bankAddress) rows.push({ label: "Bank address", value: account.bankAddress });
  return rows;
}

/**
 * Dedicated Manual Bank Transfer flow. Receives an already-created intent for
 * the customer's chosen country + currency (exact admin-configured account,
 * amount, deposit reference) and walks the investor through payment details →
 * receipt upload → PENDING confirmation.
 */
export default function BankTransferDeposit({
  intent,
  onBack,
  onDone,
  onChangeDestination,
}: {
  intent: DepositIntent;
  onBack: () => void;
  onDone?: () => void;
  onChangeDestination?: () => void;
}) {
  const [step, setStep] = useState<"details" | "upload" | "done">("details");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [senderName, setSenderName] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  const amount = Number(intent.amount);
  const account = intent.bankAccount;

  // COPY copies EXACTLY what is currently displayed on screen (all visible
  // account rows + the deposit reference the customer must quote).
  const rows = useMemo(() => (account ? accountRows(account) : []), [account]);
  const detailsText = useMemo(
    () => [...rows.map((r) => `${r.label}: ${r.value}`), `Deposit reference: ${intent.depositRef}`].join("\n"),
    [rows, intent.depositRef],
  );

  async function copyDetails() {
    if (await copyText(detailsText)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  async function submitReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a photo or PDF of your payment receipt.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (dataUrl.length > 2_500_000) throw new Error("That file is too large (max ~1.9 MB).");
      await postDepositProof({
        txnId: intent.pendingTxnId,
        method: "bank-transfer",
        amountCents: Math.round(amount * 100),
        currency: intent.currency || "USD",
        bankAccountId: account?.id ?? undefined,
        senderName,
        reference: transferRef,
        transferDate: transferDate || undefined,
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
        <BackHeader onBack={onBack} label="Bank Transfer" />
        <div className="rounded-3xl bg-gradient-to-b from-emerald-500/12 to-emerald-500/[0.02] p-6 text-center ring-1 ring-emerald-400/25">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40">
            <svg className="h-9 w-9 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="mt-4 text-[20px] font-black text-white">Deposit submitted</p>
          <p className="mt-1 text-[15px] font-bold text-zinc-300">{formatUSD(amount)}</p>
          <p className="mt-1 font-mono text-[12px] text-zinc-500">{intent.depositRef}</p>
          {account && (
            <p className="mt-1 text-[12px] text-zinc-500">
              {account.bankName} · {account.currency} ({account.countryName})
            </p>
          )}

          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-2 text-[12px] font-black uppercase tracking-[0.15em] text-amber-300 ring-1 ring-amber-400/30">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            Pending verification
          </span>

          <p className="mt-4 text-[13px] leading-6 text-zinc-400">
            Your balance is only credited after our team verifies the actual bank transfer. You will see this deposit as{" "}
            <span className="font-bold text-white">PENDING</span> until it is confirmed, then it moves to{" "}
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

  if (step === "upload") {
    return (
      <div className="space-y-4">
        <BackHeader onBack={() => setStep("details")} label="Bank Transfer" />

        <div className="rounded-3xl bg-white/[0.03] p-5 text-center ring-1 ring-white/[0.08]">
          <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Transfer amount</p>
          <p className="mt-1 text-[32px] font-black text-white">{formatUSD(amount)}</p>
          {account && (
            <p className="mt-1 text-[12px] text-zinc-500">
              Paying into {account.bankName} · {account.currency} ({account.countryName})
            </p>
          )}
          <p className="mt-0.5 font-mono text-[11px] text-zinc-600">{intent.depositRef}</p>
        </div>

        <form onSubmit={submitReceipt} className="space-y-4">
          <section className="rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/[0.08]">
            <p className="text-[13px] font-black uppercase tracking-[0.18em] text-zinc-300">Upload payment receipt</p>
            <p className="mt-1 text-[12px] text-zinc-500">Photo or PDF of your transaction receipt.</p>
            <label className="mt-3 flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] py-6 text-center transition hover:border-primary-400/50">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span className="text-3xl">📎</span>
              <span className="mt-2 text-[14px] font-bold text-white">{file ? file.name : "Choose Receipt"}</span>
              {file && <span className="mt-0.5 text-[11px] text-zinc-500">{(file.size / 1024).toFixed(0)} KB — tap to change</span>}
            </label>
          </section>

          <section className="rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/[0.08]">
            <p className="text-[13px] font-black uppercase tracking-[0.18em] text-zinc-300">Transaction reference</p>
            <p className="mt-1 text-[12px] text-zinc-500">The reference / note you used (or your bank&apos;s reference).</p>
            <input
              value={transferRef}
              onChange={(e) => setTransferRef(e.target.value)}
              placeholder="e.g. INVBT-TXN-000023"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-ink-950 px-4 py-3.5 text-[16px] text-white outline-none transition focus:border-primary-400"
            />
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-500">Sender name (optional)</span>
                <input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 text-[14px] text-white outline-none focus:border-primary-400"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-zinc-500">Transfer date</span>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-ink-950 px-3 py-2.5 text-[14px] text-white outline-none focus:border-primary-400"
                />
              </label>
            </div>
          </section>

          {error && (
            <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/30">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-grad w-full rounded-2xl py-4 text-[16px] font-black tracking-wide text-white shadow-xl shadow-primary-600/25 transition active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? "Submitting…" : "SUBMIT BANK TRANSFER"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackHeader onBack={onBack} label="Bank Transfer" />

      <div className="rounded-3xl bg-white/[0.03] p-5 text-center ring-1 ring-white/[0.08]">
        <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Amount</p>
        <p className="mt-1 text-[32px] font-black text-white">{formatUSD(amount)}</p>
        {account && (
          <p className="mt-1 text-[12px] text-zinc-500">
            Pay into {account.bankName} · {account.currency} ({account.countryName})
          </p>
        )}
      </div>

      {account && onChangeDestination && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-sky-500/[0.08] px-4 py-3 ring-1 ring-sky-500/20">
          <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-zinc-300">
            {account.countryName} · {account.currency}
          </p>
          <button
            type="button"
            onClick={onChangeDestination}
            className="shrink-0 rounded-full bg-white/[0.05] px-3 py-1.5 text-[12px] font-bold text-sky-400 ring-1 ring-white/10 transition active:scale-95"
          >
            Change
          </button>
        </div>
      )}

      <BankTransferAdvice />

      <section className="rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 ring-1 ring-white/[0.08]">
        <p className="text-[13px] font-black uppercase tracking-[0.18em] text-primary-300">Bank transfer details</p>

        {account ? (
          <dl className="mt-3 space-y-3">
            {rows.map((r) => (
              <DetailRow key={r.label} label={r.label} value={r.value} mono={r.mono} />
            ))}
            <DetailRow label="Deposit reference" value={intent.depositRef} mono />
          </dl>
        ) : (
          <p className="mt-3 rounded-2xl bg-rose-500/10 px-4 py-3 text-[13px] font-semibold text-rose-300 ring-1 ring-rose-500/30">
            Bank account unavailable for this country/currency.
          </p>
        )}

        {account && (
          <button
            onClick={copyDetails}
            className={`mt-4 w-full rounded-2xl py-3.5 text-[15px] font-black transition active:scale-[0.99] ${
              copied ? "bg-emerald-500 text-emerald-950" : "border-2 border-white/20 text-white hover:bg-white/[0.06]"
            }`}
          >
            {copied ? "✓ COPIED" : "COPY BANK DETAILS"}
          </button>
        )}
      </section>

      <button
        onClick={() => setStep("upload")}
        disabled={!account}
        className="btn-grad w-full rounded-2xl py-4 text-[16px] font-black tracking-wide text-white shadow-xl shadow-primary-600/25 transition active:scale-[0.99] disabled:opacity-40"
      >
        I&apos;ve paid — Upload receipt
      </button>
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