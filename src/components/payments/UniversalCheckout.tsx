"use client";

import { useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/payments";
import BankAccountCard from "./BankAccountCard";

export type MethodOption = {
  method: "bank-transfer" | "atm-card";
  name: string;
  icon: "bank" | "card";
  description: string;
  available: boolean;
  unavailableReason?: string;
  bankAccount?: {
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
  } | null;
};

type Props = {
  kind: "FAN_CARD" | "TICKET";
  /** Pre-resolved methods (server can pass them), or a URL to fetch them. */
  methods: MethodOption[];
  defaultMethod: "bank-transfer" | "atm-card" | null;
  amountCents: number;
  currency: string;
  purchaseTitle: string;
  accent: string;
  redirectUrl: string;
  /** Set for FAN_CARD purchases. */
  purchaseId?: string;
  /** Set for TICKET purchases. */
  orderRef?: string;
};

const inputCls =
  "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-emerald-500";

export default function UniversalCheckout(props: Props) {
  const [method, setMethod] = useState<"bank-transfer" | "atm-card" | null>(props.defaultMethod);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [senderName, setSenderName] = useState("");
  const [reference, setReference] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [proofName, setProofName] = useState<string | null>(null);
  const [proofData, setProofData] = useState<string | null>(null);

  const total = useMemo(() => formatMoney(props.amountCents / 100, props.currency), [props.amountCents, props.currency]);

  const bankAccount = props.methods.find((m) => m.method === "bank-transfer")?.bankAccount ?? null;
  const cardAvailable = props.methods.find((m) => m.method === "atm-card")?.available ?? false;
  const cardUnavailableReason = props.methods.find((m) => m.method === "atm-card")?.unavailableReason;

  const fileRef = useRef<HTMLInputElement>(null);

  const onProofFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("Proof image must be under 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProofData(String(reader.result));
      setProofName(file.name);
      setError(null);
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const submitBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!proofData) {
      setError("Please upload a payment proof (screenshot of your transfer).");
      return;
    }
    setProcessing(true);
    try {
      const endpoint =
        props.kind === "FAN_CARD"
          ? `/api/payments/${props.purchaseId}/bank-transfer`
          : `/api/tickets/orders/${props.orderRef}/bank-transfer`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName,
          reference,
          transferDate: transferDate || null,
          amountCents: props.amountCents,
          currency: props.currency,
          fileName: proofName,
          mimeType: "image",
          fileUrl: proofData,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit your transfer details.");
        setProcessing(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Your transfer details were not saved.");
      setProcessing(false);
    }
  };

  const payByCard = async () => {
    setError(null);
    setInfo(null);
    setProcessing(true);
    // The real processor provides a secure token/session. With none connected,
    // this is guarded earlier; here we push through the universal charge route.
    try {
      const res = await fetch("/api/universal/atm-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: props.kind,
          purchaseId: props.kind === "FAN_CARD" ? props.purchaseId : undefined,
          orderRef: props.kind === "TICKET" ? props.orderRef : undefined,
          provider: "secured-session-placeholder", // replaced by the real processor's token
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Card payment could not be completed.");
        setProcessing(false);
        return;
      }
      window.location.href = props.redirectUrl;
    } catch {
      setError("Network error. Please try again.");
      setProcessing(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-2xl font-black text-emerald-900">✓</div>
        <h2 className="mt-4 text-xl font-black text-white">Transfer submitted for verification</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-emerald-200/80">
          We&apos;ve received your transfer details and proof. Your purchase stays{" "}
          <span className="font-semibold text-emerald-200">Pending Verification</span> until we confirm the funds have
          arrived. This is never marked paid automatically.
        </p>
        <a
          href={props.redirectUrl}
          className="mt-6 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-bold text-emerald-900 hover:bg-emerald-50"
        >
          View your purchase
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">Step 1 · Choose how to pay</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <MethodButton
            selected={method === "bank-transfer"}
            onSelect={() => setMethod("bank-transfer")}
            title="Bank Transfer"
            subtitle="Pay into our bank account, then upload proof. We verify before confirming."
            icon="🏦"
            available
          />
          <MethodButton
            selected={method === "atm-card"}
            onSelect={() => (cardAvailable ? setMethod("atm-card") : undefined)}
            title="ATM Card"
            subtitle={cardAvailable ? "Securely pay with your ATM / debit / credit card." : cardUnavailableReason ?? "Not available yet."}
            icon="💳"
            available={cardAvailable}
            disabled={!cardAvailable}
          />
        </div>
        {!cardAvailable && cardUnavailableReason && (
          <p className="mt-2 text-xs text-zinc-500">{cardUnavailableReason}</p>
        )}
      </div>

      {method === "bank-transfer" && bankAccount && (
        <form onSubmit={submitBank} className="space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">Step 2 · Send your {total}</p>
            <p className="mt-1 text-sm text-zinc-400">
              Bank transfer to <span className="font-semibold text-white">{bankAccount.beneficiary}</span>. Use the
              reference shown so we can match your payment.
            </p>
            <div className="mt-3">
              <BankAccountCard account={bankAccount} />
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-200/90">
              <span className="mt-0.5">⚠</span>
              <span>
                We verify every transfer against our bank statements before your order is confirmed. Submitting proof
                does <strong>not</strong> automatically mark your purchase as paid.
              </span>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">Step 3 · Confirm your transfer</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Sender&apos;s name (on your bank account)</label>
                <input required value={senderName} onChange={(e) => setSenderName(e.target.value)} className={inputCls} placeholder="e.g. Jane Doe" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Transfer date</label>
                <input type="date" required value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Reference you used on the transfer</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} placeholder={`e.g. FC-${bankAccount.id.slice(-6).toUpperCase()}`} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Payment proof (screenshot of your transfer)</label>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`w-full rounded-xl border-2 border-dashed px-4 py-5 text-sm transition ${
                    proofName ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-white/15 bg-white/5 text-zinc-400 hover:border-emerald-500/40"
                  }`}
                >
                  {proofName ? `✓ ${proofName} attached` : "Click to upload a screenshot/photo of your transfer"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onProofFile} />
              </div>
            </div>
          </div>

          {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-400">
              Amount: <span className="font-black text-white">{total}</span>
            </p>
            <button
              type="submit"
              disabled={processing}
              className="btn-grad shrink-0 rounded-full px-8 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {processing ? "Submitting…" : "Submit transfer for verification"}
            </button>
          </div>
        </form>
      )}

      {method === "atm-card" && (
        <div className="space-y-4">
          {cardAvailable ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">Step 2 · Card payment</p>
              <p className="mt-1 text-sm text-zinc-400">You&apos;ll be taken to a secure card screen to authorize {total}.</p>
              {error && <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
              <button
                onClick={payByCard}
                disabled={processing}
                className="btn-grad mt-4 rounded-full px-8 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {processing ? "Connecting to secure card screen…" : `Pay ${total} by card`}
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-zinc-400">
              <p className="font-semibold text-zinc-200">ATM Card is not enabled yet.</p>
              <p className="mt-1">{cardUnavailableReason ?? "No card processor is connected on this site."} Please use Bank Transfer.</p>
            </div>
          )}
        </div>
      )}

      {!method && (
        <p className="text-sm text-zinc-500">{info ?? "Choose a payment method above."}</p>
      )}
    </div>
  );
}

function MethodButton(props: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  icon: string;
  available: boolean;
  disabled?: boolean;
}) {
  const { selected, onSelect, title, subtitle, icon, available, disabled } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`text-left rounded-2xl border p-4 transition ${
        disabled
          ? "cursor-not-allowed border-white/5 bg-white/[0.02] opacity-60"
          : selected
          ? "border-emerald-500/60 bg-emerald-500/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/25"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="min-w-0">
          <p className="font-bold text-white">{title}</p>
          <p className="truncate text-xs text-zinc-400">{subtitle}</p>
        </div>
        {available && (
          <span className={`ml-auto h-2.5 w-2.5 shrink-0 rounded-full ${selected ? "bg-emerald-400" : "bg-zinc-600"}`} />
        )}
      </div>
    </button>
  );
}