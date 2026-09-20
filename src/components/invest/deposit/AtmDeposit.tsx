"use client";

import { useState } from "react";
import { formatUSD } from "./depositShared";

/**
 * ATM Card — powered by Flutterwave.
 *
 * The manual ATM deposit form is gone. Tapping "Pay with Flutterwave" opens a
 * REAL hosted checkout on Flutterwave's own secure page (created server-side —
 * secret keys never leave the backend). After payment the customer returns to
 * /invest/deposit/flutterwave, where the charge is verified server-side and the
 * balance is credited ONLY after that verification. The browser can never claim
 * a payment succeeded by itself.
 */
export default function AtmDeposit({
  amount,
  onBack,
}: {
  /** Amount to pay (USD). */
  amount: number;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "creating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function payWithFlutterwave() {
    if (status === "creating") return;
    setStatus("creating");
    setError(null);
    try {
      const res = await fetch("/api/invest/deposits/flutterwave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: String(amount) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start your card payment. Please try again.");
      if (!data.link) throw new Error("The payment could not be started. Please try again.");
      // Redirect to Flutterwave's official secure checkout page.
      window.location.assign(data.link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start your card payment. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <BackHeader onBack={onBack} label="ATM Card" />

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#101427] via-[#0b0f1d] to-[#080a12] p-5 ring-1 ring-white/[0.08]">
        <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-primary-600/25 blur-[70px]" />
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">You are paying</p>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-black tracking-widest text-primary-200 ring-1 ring-white/10">
            USD
          </span>
        </div>
        <p className="mt-2 text-[38px] font-black leading-none tracking-tight text-white">{formatUSD(amount)}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">Securely with your debit or credit card.</p>
      </div>

      <section className="rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 ring-1 ring-white/[0.08]">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-2xl ring-1 ring-white/10">
            💳
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-black tracking-wide text-white">ATM Card · Flutterwave</p>
            <p className="text-[12px] text-zinc-400">Instant card payment · Visa, Mastercard, Verve & more</p>
          </div>
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-500 text-[12px] font-black text-white">
            ✓
          </span>
        </div>

        <div className="mt-4 space-y-2.5">
          <DetailRow label="Payment via" value="Flutterwave secure checkout" />
          <DetailRow label="Voucher / reference" value="Created when you pay" assertMuted />
          <DetailRow label="Verification" value="Automatic · server-side" assertMuted />
        </div>

        <div className="mt-4 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/10">
          <p className="text-[12px] leading-6 text-zinc-400">
            You&apos;ll be taken to <b className="text-zinc-200">Flutterwave&apos;s official page</b> to enter your card
            details. Your balance is credited automatically the moment{" "}
            <b className="text-zinc-200">Flutterwave confirms your payment</b> — no manual review needed. Card details
            never touch CelebrityPass.
          </p>
        </div>
      </section>

      {error && (
        <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/30">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void payWithFlutterwave()}
        disabled={status === "creating"}
        className="btn-grad flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-[16px] font-black tracking-wide text-white shadow-xl shadow-primary-600/25 transition active:scale-[0.99] disabled:opacity-60"
      >
        {status === "creating" ? (
          <>
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Opening secure checkout…
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <path d="M3 10h18" />
            </svg>
            PAY WITH FLUTTERWAVE
          </>
        )}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-zinc-500">
        <svg className="h-4 w-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2a8 8 0 016.78 12.37l3.2 3.2a1 1 0 01-1.42 1.42l-3.2-3.2A8 8 0 1112 2zm4.5 9.5a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
        </svg>
        Secured by Flutterwave · Powered by CelebrityPass
      </p>
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

function DetailRow({
  label,
  value,
  assertMuted,
}: {
  label: string;
  value: string;
  assertMuted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.08]">
      <span className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={`break-all text-right text-[14px] font-bold text-white ${assertMuted ? "text-zinc-400" : ""}`}>
        {value}
      </span>
    </div>
  );
}