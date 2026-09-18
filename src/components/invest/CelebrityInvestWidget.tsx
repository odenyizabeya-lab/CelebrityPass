"use client";

import { useMemo, useState, type FormEvent } from "react";

export type CelebrityOppPeriod = {
  opensAt?: string;
  closesAt?: string;
  lockupDays?: number;
  maturityLabel?: string;
};

export type CelebrityOpp = {
  id: string;
  slug: string;
  name: string;
  companyName: string | null;
  investmentType: string;
  description: string | null;
  status: string;
  minAmount: number | null;
  maxAmount: number | null;
  raisedAmount: number;
  targetAmount: number | null;
  currency: string;
  fees: { subscriptionRate?: number } | null;
  liquidityText: string | null;
  risksText: string | null;
  expectedReturnText: string | null;
  legalTermsText: string | null;
  eligibilityText: string | null;
  period: CelebrityOppPeriod | null;
  linkedCelebrityName: string | null;
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
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "admin@celebritypass.app";

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function BankTransfer({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10h18M7 15h.01M11 15h.01M17 15h.01M5 10V8m14 2V8M3 10l1.2-3.6A2 2 0 016.1 5h11.8a2 2 0 011.9 1.4L21 10M3 10v1a1 1 0 001 1h16a1 1 0 001-1v-1M6 19h12"
      />
    </svg>
  );
}

function ClipboardCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

function UserCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h8.5m6.5-4l1.5 1.5L19 21"
      />
    </svg>
  );
}

function Lock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 11V6a3 3 0 00-6 0v5M8 11h8a2 2 0 012 2v5a2 2 0 01-2 2H8a2 2 0 01-2-2v-5a2 2 0 012-2z"
      />
    </svg>
  );
}

function Chip({ label, tone = "default" }: { label: string; tone?: "default" | "emerald" | "amber" }) {
  const tones: Record<string, string> = {
    default: "text-zinc-300 ring-white/15 bg-white/[0.05]",
    emerald: "text-emerald-300 ring-emerald-400/25 bg-emerald-500/[0.08]",
    amber: "text-amber-300 ring-amber-400/25 bg-amber-400/[0.07]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${tones[tone]}`}>
      {label}
    </span>
  );
}

export default function CelebrityInvestWidget({ celebrityName, opportunities }: { celebrityName: string; opportunities: CelebrityOpp[] }) {
  const [oppIndex, setOppIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<"pick" | "pay" | "upload" | "done">("pick");
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

  const proofPercent =
    opp.targetAmount && opp.targetAmount > 0 ? Math.min(100, Math.round((opp.raisedAmount / opp.targetAmount) * 100)) : 0;
  const closesLabel = fmtDate(opp.period?.closesAt);
  const feeLabel = opp.fees?.subscriptionRate
    ? `${opp.fees.subscriptionRate}% subscription fee`
    : "No platform fees ($0)";

  async function startPayment(e: FormEvent) {
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

  async function submitReceipt(e: FormEvent) {
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

  function TrustItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/[0.1] text-emerald-400 ring-1 ring-emerald-400/20">
          {icon}
        </span>
        <span>
          <span className="block text-sm font-bold text-white">{title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">{body}</span>
        </span>
      </div>
    );
  }

  if (stage === "pay" && intent) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Step 2 — Make your payment</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-2xl font-black tracking-tight text-white">${money(Number(intent.amount))} USD</span>
            <span className="text-sm text-zinc-300">
              to <span className="font-bold text-white">{intent.bankAccount?.beneficiary ?? "the verified beneficiary"}</span>
            </span>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400">✓</span>
              You pay manually from your own bank app or ATM — we never charge a card or auto-debit.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400">✓</span>
              Write your deposit reference in the transfer note so we can match it to you.
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Payment summary</p>
          <div className="mt-2.5 grid gap-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-zinc-400">Investment amount</span>
              <span className="font-bold text-white">${money(Number(intent.amount))} {opp.currency}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-zinc-400">Platform fees</span>
              <span className="font-bold text-white">{feeLabel}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-zinc-400">You&apos;ll deposit</span>
              <span className="font-black text-emerald-300">${money(Number(intent.amount))} {opp.currency}</span>
            </div>
            {opp.period?.maturityLabel ? (
              <div className="flex justify-between gap-3">
                <span className="text-zinc-400">Locked until maturity</span>
                <span className="font-bold text-white">~{opp.period.maturityLabel}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Deposit reference — use this on your transfer</p>
          <div className="flex items-center gap-2 rounded-2xl border border-primary-500/30 bg-primary-500/[0.08] px-4 py-3">
            <CopyRow label="Deposit reference" value={intent.depositRef} />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Receiving bank account</p>
          <div className="space-y-2.5">
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
            Attach a clear photo or screenshot of your ATM slip / bank transfer receipt showing the amount and the deposit
            reference <span className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono font-bold text-white">{intent.depositRef}</span>.
            Our team verifies it against the real bank statement before crediting you.
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

        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3 text-xs leading-relaxed text-zinc-500">
          Your receipt is seen only by our internal verification team and is never shared or published. If your transfer
          doesn&apos;t match the bank statement, it is never approved and we tell you why.
        </div>

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
      <div className="rounded-3xl border border-emerald-400/25 bg-emerald-400/[0.06] p-6">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
          <ClipboardCheck className="h-7 w-7 text-emerald-400" />
        </div>
        <h3 className="mt-4 text-center text-xl font-black text-white">Receipt submitted</h3>
        <p className="mx-auto mt-2 max-w-md text-center text-sm leading-relaxed text-zinc-300">
          Your deposit is now <span className="font-bold text-white">pending verification</span>. Nothing is credited until
          our team matches your transfer to the real bank statement.
        </p>

        <div className="mx-auto mt-5 max-w-md">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">What happens next</p>
          <ol className="mt-2.5 space-y-2.5 text-sm text-zinc-300">
            <li className="flex items-start gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-400/25">1</span>
              We verify your receipt against the real bank statement (usually within hours on business days).
            </li>
            <li className="flex items-start gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-400/25">2</span>
              Your investment is credited and recorded on the platform ledger from that moment.
            </li>
            <li className="flex items-start gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-[11px] font-black text-emerald-300 ring-1 ring-emerald-400/25">3</span>
              You receive an email confirmation with your position and reference.
            </li>
          </ol>
        </div>

        <p className="mt-5 text-center font-mono text-xs text-zinc-500">Deposit {intent?.depositRef}</p>
        <p className="mt-3 text-center text-xs text-zinc-500">
          Questions?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-emerald-300 underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={startPayment} className="space-y-5">
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

      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300 ring-1 ring-emerald-400/25">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified offering
          </span>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400 ring-1 ring-emerald-400/20">
            {opp.status === "OPEN" ? "Open for investment" : "Pending"}
          </span>
        </div>

        <h3 className="mt-3 text-xl font-black tracking-tight text-white">
          Invest in {opp.name}
          {opp.companyName ? <span className="ml-1.5 text-base font-normal text-zinc-400">· {opp.companyName}</span> : null}
        </h3>
        {opp.description && <p className="mt-2 text-sm leading-relaxed text-zinc-400">{opp.description}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip label={`Range · $${money(bounds.lo)} – $${money(bounds.hi)}`} />
          <Chip label={feeLabel} tone="emerald" />
          {opp.period?.maturityLabel ? <Chip label={`Lockup · ~${opp.period.maturityLabel}`} tone="amber" /> : null}
          {closesLabel ? <Chip label={`Closes · ${closesLabel}`} /> : null}
        </div>

        <div className="mt-5">
          {opp.raisedAmount > 0 && opp.targetAmount && opp.targetAmount > 0 ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                <span className="font-bold uppercase tracking-widest text-zinc-400">Funded so far</span>
                <span className="text-zinc-300">
                  <span className="font-black text-white">${money(opp.raisedAmount)}</span> of ${money(opp.targetAmount)} ({proofPercent}%)
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${proofPercent}%` }} />
              </div>
            </>
          ) : (
            <p className="rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-xs leading-relaxed text-zinc-400 ring-1 ring-white/10">
              Fundraising just opened — be among the first verified investors. Amounts credited are recorded transparently
              on this page as they are confirmed.
            </p>
          )}
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
          Officially linked to {celebrityName} on their verified profile
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <TrustItem
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Bank-transfer verified"
          body="Money is confirmed against the real bank statement before anything is credited. No auto-approvals."
        />
        <TrustItem
          icon={<BankTransfer className="h-5 w-5" />}
          title="Bank-to-bank only"
          body="You pay from your own bank app or ATM. No card, no auto-charge, no hidden fees."
        />
        <TrustItem
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="Receipt-backed proof"
          body="Every deposit is matched to your receipt and recorded on the platform ledger."
        />
        <TrustItem
          icon={<Lock className="h-5 w-5" />}
          title={opp.period?.maturityLabel ? `Locked ~${opp.period.maturityLabel}` : "Term-based"}
          body="Your funds sit in a term-based position until maturity — see the full terms below."
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">How it works — 4 steps</p>
        <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {[
            ["Choose your amount", "Pick a USD investment between the published minimum and maximum."],
            ["Pay once from your bank", "Send the exact amount to the named beneficiary using your deposit reference."],
            ["Upload your receipt", "Photo of the ATM slip or transfer — proof is always kept."],
            ["We verify and credit", "A human matches your receipt to the bank statement; only then is it credited."],
          ].map(([t, b]) => (
            <li key={t} className="flex items-start gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[11px] font-black text-emerald-300 ring-1 ring-white/15">
                {[
                  ["Choose your amount"],
                  ["Pay once from your bank"],
                  ["Upload your receipt"],
                  ["We verify and credit"],
                ].findIndex((x) => x[0] === t) + 1}
              </span>
              <span>
                <span className="block font-bold text-white">{t}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">{b}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <details className="group rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold text-white">
          Terms, liquidity and risk
          <span className="text-zinc-500 transition group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-400">
          {opp.eligibilityText ? <p>{opp.eligibilityText}</p> : null}
          {opp.liquidityText ? <p>{opp.liquidityText}</p> : null}
          {opp.expectedReturnText ? <p>{opp.expectedReturnText}</p> : null}
          {!opp.expectedReturnText ? (
            <p>No projected return is shown here because we never print unverified performance figures.</p>
          ) : null}
          {opp.risksText ? <p>{opp.risksText}</p> : null}
          {opp.legalTermsText ? <p className="text-xs text-zinc-500">{opp.legalTermsText}</p> : null}
        </div>
      </details>

      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3 text-xs leading-relaxed text-amber-200/90">
        <span className="font-black uppercase tracking-widest text-amber-300">Nothing is auto-approved. </span>
        Your money is only credited after our team verifies your receipt against the real bank statement. If it doesn&apos;t
        match, it is never credited and we explain why — so your payment is always in your control.
      </div>

      <label className="block text-sm text-zinc-400">
        Investment amount (USD)
        <input
          type="number"
          min={bounds.lo}
          max={bounds.hi}
          step="0.01"
          required
          placeholder={`$${money(bounds.lo)} – $${money(bounds.hi)}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-lg font-black text-white outline-none focus:border-primary-500"
        />
      </label>
      {amountError && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{amountError}</p>}
      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>}

      <button
        type="submit"
        disabled={busy || !!amountError}
        className="btn-grad w-full rounded-full px-6 py-3.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "Preparing…" : `Continue to payment · $${amount && !amountError ? money(Number(amount)) : "—"}`}
      </button>
      <p className="text-center text-xs leading-relaxed text-zinc-500">
        Minimum ${money(bounds.lo)} · Bank-transfer verified · {celebrityName}&apos;s verified offering
        <br />
        Questions before investing?{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-emerald-300 underline underline-offset-2">
          {SUPPORT_EMAIL}
        </a>
      </p>
    </form>
  );
}