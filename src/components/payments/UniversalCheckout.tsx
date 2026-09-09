"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { formatMoney } from "@/lib/payments";
import { useLanguage } from "@/lib/i18n/language-context";
import BankAccountCard from "./BankAccountCard";

export type MethodOption = {
  method: "bank-transfer" | "atm-card";
  name: string;
  icon: "bank" | "card";
  description: string;
  available: boolean;
  unavailableReason?: string;
  bankAccounts?: {
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
  }[];
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
  methods: MethodOption[];
  defaultMethod: "bank-transfer" | "atm-card" | null;
  amountCents: number;
  currency: string;
  purchaseTitle: string;
  accent: string;
  redirectUrl: string;
  purchaseId?: string;
  orderRef?: string;
};

const inputCls =
  "w-full rounded-2xl border border-white/10 bg-ink-800 px-5 py-4 text-base text-white placeholder-zinc-500 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

function formatCardNumber(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

function StepHeader({ n, title, subtitle }: { n: number; title: string; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-base font-black text-white ring-1 ring-white/15">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-black tracking-tight text-white">{title}</p>
        {subtitle && <p className="mt-1 text-sm leading-relaxed text-zinc-400">{subtitle}</p>}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-[15px] font-bold text-zinc-200">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{hint}</p>}
    </div>
  );
}

export default function UniversalCheckout(props: Props) {
  const { t } = useLanguage();
  const [method, setMethod] = useState<"bank-transfer" | "atm-card" | null>(props.defaultMethod);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const bankAccounts = props.methods.find((m) => m.method === "bank-transfer")?.bankAccounts ?? [];
  const defaultBankAccount = props.methods.find((m) => m.method === "bank-transfer")?.bankAccount ?? bankAccounts[0] ?? null;
  const [selectedBankId, setSelectedBankId] = useState<string | null>(defaultBankAccount?.id ?? null);
  const selectedBankAccount = bankAccounts.find((a) => a.id === selectedBankId) ?? defaultBankAccount ?? bankAccounts[0] ?? null;

  const [amountSent, setAmountSent] = useState<string>((props.amountCents / 100).toFixed(2));

  // Bank transfer fields
  const [senderName, setSenderName] = useState("");
  const [reference, setReference] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [proofName, setProofName] = useState<string | null>(null);
  const [proofData, setProofData] = useState<string | null>(null);

  // Card fields
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const [refCopied, setRefCopied] = useState(false);

  const total = useMemo(() => formatMoney(props.amountCents / 100, props.currency), [props.amountCents, props.currency]);

  const bankAccount = selectedBankAccount;
  const cardAvailable = props.methods.find((m) => m.method === "atm-card")?.available ?? false;
  const cardUnavailableReason = props.methods.find((m) => m.method === "atm-card")?.unavailableReason;

  const fileRef = useRef<HTMLInputElement>(null);

  const suggestedRef = bankAccount ? `FC-${bankAccount.id.slice(-6).toUpperCase()}` : "";

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
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
    }
  };

  const onCopyRef = async () => {
    if (!suggestedRef) return;
    await copyText(suggestedRef);
    setRefCopied(true);
    setTimeout(() => setRefCopied(false), 1800);
  };

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

  const clearProof = () => {
    setProofData(null);
    setProofName(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submitBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!proofData) {
      setError("Please upload a payment proof (screenshot of your transfer).");
      return;
    }
    if (!bankAccount) {
      setError("Please choose the bank account you transferred to.");
      return;
    }
    const amountCents = Math.round((Number.parseFloat(amountSent) || 0) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError("Enter the amount you actually sent (in the currency of the account you paid into).");
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
          amountCents,
          currency: bankAccount.currency,
          bankAccountId: bankAccount.id,
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

  const payByCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!cardName.trim()) { setError("Enter the cardholder name."); return; }
    const num = cardNumber.replace(/\s+/g, "");
    if (num.length < 13 || num.length > 19 || !/^\d+$/.test(num)) { setError("Enter a valid card number."); return; }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) { setError("Enter expiry as MM/YY."); return; }
    if (!/^\d{3,4}$/.test(cardCvc)) { setError("Enter a valid security code."); return; }

    setProcessing(true);
    try {
      if (props.kind === "FAN_CARD") {
        const res = await fetch(`/api/payments/${props.purchaseId}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            card: { name: cardName, number: num, expiry: cardExpiry, cvc: cardCvc },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Card payment failed. Please try again.");
          setProcessing(false);
          return;
        }
        window.location.href = props.redirectUrl;
      } else {
        const res = await fetch("/api/universal/atm-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "TICKET",
            orderRef: props.orderRef,
            card: { name: cardName, number: num, expiry: cardExpiry, cvc: cardCvc },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Card payment could not be completed.");
          setProcessing(false);
          return;
        }
        window.location.href = props.redirectUrl;
      }
    } catch {
      setError("Network error. Please try again.");
      setProcessing(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-3xl font-black text-emerald-900 shadow-lg shadow-emerald-500/30">✓</div>
        <h2 className="mt-5 text-2xl font-black tracking-tight text-white">Transfer submitted for verification</h2>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-emerald-200/80">
          We&apos;ve received your transfer details and proof. Your purchase stays{" "}
          <span className="font-semibold text-emerald-200">Pending Verification</span> until we confirm the funds have
          arrived. This is never marked paid automatically.
        </p>
        <a
          href={props.redirectUrl}
          className="btn-grad mt-7 inline-block rounded-2xl px-8 py-3.5 text-sm font-black text-white"
        >
          View your purchase
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <StepHeader
          n={1}
          title="Choose how to pay"
          subtitle="Pick the payment method that works best for you."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
            {cardUnavailableReason}
          </p>
        )}
      </div>

      {method === "bank-transfer" && bankAccount && (
        <form onSubmit={submitBank} className="space-y-8">
          {/* Step 2 — currency */}
          <div>
            <StepHeader
              n={2}
              title="Choose your currency"
              subtitle={<>Your order amount (<span className="font-black text-white">{total}</span>) stays the same in your order currency — the currency you actually send just tells us which bank account the money lands in.</>}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {bankAccounts.map((a) => {
                const selected = a.id === bankAccount.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedBankId(a.id)}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                      selected ? "border-emerald-500/60 bg-emerald-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/10 text-2xl">
                      {a.countryFlag ?? "🏦"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-black text-white">{a.currency} Account</span>
                      <span className="block truncate text-sm text-zinc-400">{a.countryName} · {a.bankName}</span>
                    </span>
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
                        selected ? "border-emerald-400 bg-emerald-500/20" : "border-zinc-600"
                      }`}
                    >
                      {selected && <span className="h-3 w-3 rounded-full bg-emerald-400" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3 — send */}
          <div>
            <StepHeader
              n={3}
              title={`Send ${formatMoney(Number(amountSent) || 0, bankAccount.currency)}`}
              subtitle={
                <>
                  Bank transfer to <span className="font-black text-white">{bankAccount.beneficiary}</span> at{" "}
                  <span className="font-black text-white">{bankAccount.bankName}</span>. Use the reference shown so we can
                  match your payment to your order.
                </>
              }
            />
            <div className="mt-4">
              <BankAccountCard account={bankAccount} />
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm leading-relaxed text-amber-200/90">
              <span className="mt-0.5 text-lg">⚠</span>
              <span className="min-w-0">
                We verify every transfer against our bank statements before your order is confirmed. Submitting proof
                does <strong>not</strong> automatically mark your purchase as paid.
              </span>
            </div>
          </div>

          {/* Step 4 — confirm */}
          <div>
            <StepHeader
              n={4}
              title="Confirm your transfer"
              subtitle="Fill in the details exactly as they appear on your bank receipt."
            />
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field label="Sender's name (on your bank account)">
                <input required value={senderName} onChange={(e) => setSenderName(e.target.value)} className={inputCls} placeholder="e.g. Jane Doe" />
              </Field>
              <Field label="Transfer date">
                <input type="date" required value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label={`Amount you sent (${bankAccount.currency})`}
                  hint="Defaults to your order amount. If the amount you sent differs (transfer fees, rounding), enter the exact amount."
                >
                  <div className="relative">
                    <input
                      required
                      inputMode="decimal"
                      value={amountSent}
                      onChange={(e) => setAmountSent(e.target.value)}
                      className={`${inputCls} pr-16 font-mono font-semibold`}
                      placeholder="0.00"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-300">
                      {bankAccount.currency}
                    </span>
                  </div>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Reference you used on the transfer"
                  hint="Make sure this matches your bank receipt so we can find your payment."
                >
                  <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} placeholder={suggestedRef} />
                </Field>
                {suggestedRef && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5">
                    <span className="text-sm text-zinc-400">Suggested reference:</span>
                    <span className="font-mono text-base font-black tracking-wide text-white">{suggestedRef}</span>
                    <button
                      type="button"
                      onClick={onCopyRef}
                      className={`shrink-0 rounded-xl border px-4 py-1.5 text-xs font-bold transition ${
                        refCopied
                          ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                          : "border-white/15 bg-white/5 text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-300"
                      }`}
                    >
                      {refCopied ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <Field label="Payment proof (screenshot of your transfer)">
                  {proofName ? (
                    <div className="flex items-center justify-between gap-4 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 px-5 py-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                            <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-white">{proofName}</p>
                          <p className="text-sm text-emerald-300/80">Attached — we&apos;ll verify it manually.</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/20"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={clearProof}
                          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:border-rose-400/40 hover:text-rose-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="group w-full rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center transition hover:border-emerald-500/50 hover:bg-emerald-500/[0.04]"
                    >
                      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-zinc-400 transition group-hover:bg-emerald-500/15 group-hover:text-emerald-300">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                          <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </span>
                      <p className="mt-4 text-base font-black text-white">Tap to upload your transfer receipt</p>
                      <p className="mt-1 text-sm text-zinc-500">Screenshot or photo of your transfer · PNG/JPG · max 3 MB</p>
                    </button>
                  )}
                </Field>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onProofFile} />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm font-semibold leading-relaxed text-rose-300">
              {error}
            </div>
          )}

          {/* Amount summary + submit */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Order amount</p>
                  <p className="text-3xl font-black tracking-tight text-white">{total}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">You&apos;ll send into {bankAccount.currency} account</p>
                  <p className="text-3xl font-black tracking-tight text-emerald-300">
                    {formatMoney(Number(amountSent) || 0, bankAccount.currency)}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={processing}
              className="btn-grad w-full rounded-2xl py-4.5 text-lg font-black tracking-tight text-white shadow-xl shadow-emerald-500/20 transition disabled:opacity-60"
            >
              {processing ? "Submitting…" : "Submit transfer for verification"}
            </button>
            <p className="text-center text-xs leading-relaxed text-zinc-500">
              By submitting, you confirm you have completed the transfer to the bank account shown above.
            </p>
          </div>
        </form>
      )}

      {method === "atm-card" && cardAvailable && (
        <form onSubmit={payByCard} className="space-y-6">
          <div>
            <StepHeader n={2} title="Card payment" subtitle={`Enter your card details to pay ${total} securely.`} />
          </div>

          <div className="space-y-5">
            <Field label={t("checkout.nameOnCard")}>
              <input required value={cardName} onChange={(e) => setCardName(e.target.value)} className={inputCls} placeholder={t("checkout.nameOnCard")} />
            </Field>
            <Field label={t("checkout.cardNumber")}>
              <input
                required
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                className={`${inputCls} font-mono tracking-wider`}
                placeholder="4242 4242 4242 4242"
              />
            </Field>
            <div className="grid grid-cols-2 gap-5">
              <Field label={t("checkout.expiry")}>
                <input required inputMode="numeric" value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} className={`${inputCls} font-mono`} placeholder="MM/YY" />
              </Field>
              <Field label={t("checkout.cvc")}>
                <input required inputMode="numeric" value={cardCvc} onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} className={`${inputCls} font-mono`} placeholder="123" />
              </Field>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm font-semibold leading-relaxed text-rose-300">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <p className="text-sm text-zinc-500">{t("checkout.secureNote")}</p>
            <button
              type="submit"
              disabled={processing}
              className="btn-grad w-full rounded-2xl py-4.5 text-lg font-black tracking-tight text-white transition disabled:opacity-60"
            >
              {processing ? t("checkout.processing") : `${t("checkout.payNow")} · ${total}`}
            </button>
          </div>
        </form>
      )}

      {method === "atm-card" && !cardAvailable && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-7 text-base leading-relaxed text-zinc-400">
          <p className="font-bold text-zinc-200">ATM Card is not enabled yet.</p>
          <p className="mt-1.5">{cardUnavailableReason ?? "No card processor is connected on this site."} Please use Bank Transfer.</p>
        </div>
      )}

      {!method && (
        <p className="text-base text-zinc-500">{info ?? "Choose a payment method above."}</p>
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
      className={`text-left rounded-2xl border p-4.5 transition ${
        disabled
          ? "cursor-not-allowed border-white/5 bg-white/[0.02] opacity-60"
          : selected
          ? "border-emerald-500/60 bg-emerald-500/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/25"
      }`}
    >
      <div className="flex items-center gap-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black text-white">{title}</p>
          <p className="mt-0.5 text-sm leading-snug text-zinc-400">{subtitle}</p>
        </div>
        {available && (
          <span className={`ml-auto h-3 w-3 shrink-0 rounded-full ${selected ? "bg-emerald-400" : "bg-zinc-600"}`} />
        )}
      </div>
    </button>
  );
}