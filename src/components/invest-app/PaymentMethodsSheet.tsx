"use client";

import { useState } from "react";
import { formatUSD, postDepositIntent, type DepositIntent } from "@/components/invest/deposit/depositShared";
import BankTransferDeposit from "@/components/invest/deposit/BankTransferDeposit";
import BankTransferPayout from "@/components/invest/deposit/BankTransferPayout";
import AtmDeposit from "@/components/invest/deposit/AtmDeposit";
import { Eye } from "@/components/invest-app/native";

type MethodKey = "bank-transfer" | "atm-deposit";

const METHODS: { key: MethodKey; name: string; title: string; tagline: string; icon: string; accent: string; desc: string }[] = [
  {
    key: "bank-transfer",
    name: "BANK TRANSFER",
    title: "Manual Bank Transfer",
    tagline: "Pay from your bank account",
    icon: "🏦",
    accent: "from-sky-500/20 to-sky-500/5 ring-sky-400/40",
    desc: "Full bank details, the exact amount to pay, and a clear “I have made the transfer” step to submit your payment for verification.",
  },
  {
    key: "atm-deposit",
    name: "ATM PAYMENT",
    title: "ATM Payment",
    tagline: "Deposit cash at an ATM",
    icon: "🏧",
    accent: "from-emerald-500/20 to-emerald-500/5 ring-emerald-400/40",
    desc: "Step-by-step ATM instructions with your deposit reference, plus a receipt/reference submission for verification.",
  },
];

/**
 * Native full-screen Payment Methods sheet for funding an order.
 *
 * Both channels are REAL payments: they reuse the exact same deposit intent +
 * receipt-verification system as /invest/deposit. A pending ledger transaction
 * is opened, the user pays, submits proof, and the balance is only credited
 * after an admin verifies the actual receipt — the backend is the source of
 * truth. Nothing here invents a payment.
 */
export function PaymentMethodsSheet({
  symbol,
  companyName,
  amountCents,
  onClose,
  onPaymentSubmitted,
}: {
  symbol: string;
  companyName: string;
  amountCents: number;
  onClose: () => void;
  onPaymentSubmitted: () => void;
}) {
  const [intent, setIntent] = useState<DepositIntent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectingBank, setSelectingBank] = useState(false);

  const amount = amountCents / 100;

  async function openMethod(key: MethodKey) {
    // Bank Transfer first shows COUNTRY → CURRENCY (only admin-configured
    // combos); the intent + exact account open only after both are chosen.
    if (key === "bank-transfer") {
      setError(null);
      setSelectingBank(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await postDepositIntent(String(amount), key);
      setIntent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start your payment. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function backToMethods() {
    setIntent(null);
    setSelectingBank(false);
    setError(null);
  }

  function done() {
    onPaymentSubmitted();
    onClose();
  }

  // A payment method is open — render ONLY that method's dedicated flow. The
  // flow itself ends on a "Pending verification" screen before returning here.
  if (intent) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#05060a]">
        <div className="mx-auto w-full max-w-xl px-4 pb-14 pt-4">
          <div className="fade-up">
            {intent.method === "atm-deposit" ? (
              <AtmDeposit intent={intent} onBack={backToMethods} onDone={done} />
            ) : (
              <BankTransferDeposit
                intent={intent}
                onBack={backToMethods}
                onDone={done}
                onChangeDestination={() => {
                  setIntent(null);
                  setSelectingBank(true);
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Bank Transfer's COUNTRY → CURRENCY selection, before the intent opens.
  if (selectingBank) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#05060a]">
        <div className="mx-auto w-full max-w-xl px-4 pb-14 pt-4">
          <div className="fade-up">
            <BankTransferPayout
              amount={amount}
              onBack={() => setSelectingBank(false)}
              onIntent={(data) => {
                setIntent(data);
                setSelectingBank(false);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#05060a]">
      <div className="mx-auto w-full max-w-xl space-y-4 px-4 pb-14 pt-4">
        {/* Native header */}
        <div className="flex items-center gap-2.5">
          <button
            aria-label="Back to order"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.05] text-zinc-300 ring-1 ring-white/10 transition active:scale-90"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-[17px] font-black tracking-wide text-white">Payment methods</p>
            <p className="truncate text-[12px] text-zinc-500">Fund your {symbol} investment</p>
          </div>
        </div>

        {/* Amount the user needs to pay */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#101427] via-[#0b0f1d] to-[#080a12] p-5 ring-1 ring-white/[0.08]">
          <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-primary-600/20 blur-[70px]" />
          <Eye>Amount to pay</Eye>
          <p className="mt-2 text-[40px] font-black leading-none tracking-tight text-white">{formatUSD(amount)}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">
            for {companyName} ({symbol}). Your balance is credited only after an admin verifies your payment — nothing
            is credited instantly or on your word alone.
          </p>
        </section>

        {/* Choose payment method */}
        <section>
          <Eye>Choose how to pay</Eye>
          <div className="mt-2 space-y-2.5">
            {METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                disabled={busy}
                onClick={() => void openMethod(m.key)}
                className={`w-full rounded-3xl bg-gradient-to-br p-4 text-left ring-1 transition active:scale-[0.99] disabled:opacity-50 ${m.accent}`}
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-2xl ring-1 ring-white/10">
                    {m.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-black tracking-wide text-white">{m.name}</span>
                    <span className="block text-[12px] text-zinc-400">{m.tagline}</span>
                  </span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[14px] font-black text-white ring-1 ring-white/10">
                    ›
                  </span>
                </span>
                <span className="mt-3 block text-[12px] leading-5 text-zinc-400">{m.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white/[0.02] px-4 py-3.5 ring-1 ring-white/[0.06]">
          <p className="text-[12px] leading-6 text-zinc-500">
            After you submit your payment you will see a{" "}
            <span className="font-bold text-amber-300">Pending verification</span> status until our team confirms the
            transfer, then your available balance is updated and you can complete your order.
          </p>
        </section>

        {error && (
          <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/30">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}