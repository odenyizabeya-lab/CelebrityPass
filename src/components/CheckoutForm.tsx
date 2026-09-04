"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/payments";

type Props = {
  paymentId: string;
  amount: number;
  currency: string;
  description: string;
  celebrityName: string;
  celebritySlug: string;
  accent: string;
};

export default function CheckoutForm(props: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const total = useMemo(() => formatMoney(props.amount, props.currency), [props.amount, props.currency]);

  const formatCardNumber = (v: string) =>
    v
      .replace(/\D/g, "")
      .slice(0, 19)
      .replace(/(\d{4})(?=\d)/g, "$1 ");

  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setProcessing(true);
    try {
      const res = await fetch(`/api/payments/${props.paymentId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card: { name, number, expiry, cvc } }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Payment failed. Please try again.");
        setProcessing(false);
        return;
      }
      router.push(`/celebrity/${data.card.celebritySlug}/fan/${data.card.fanNumber}`);
    } catch {
      setError("Network error. Please try again.");
      setProcessing(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* Order summary */}
      <div
        className="relative overflow-hidden rounded-3xl p-7 text-white shadow-xl ring-1 ring-white/15"
        style={{ background: `linear-gradient(130deg, ${props.accent}, #27104a 45%, #0b0c10)` }}
      >
        <div className="pointer-events-none absolute -inset-x-10 -top-16 h-40 rotate-6 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Order Summary</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Your {props.celebrityName} Fan Card</h1>
          <p className="mt-1 text-sm text-white/70">{props.description}</p>

          <div className="mt-8 space-y-3 border-t border-white/15 pt-6 text-sm">
            <div className="flex justify-between">
              <span className="text-white/70">Membership</span>
              <span className="font-semibold text-white">{props.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Community</span>
              <span className="font-semibold text-white">{props.celebrityName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Card</span>
              <span className="font-semibold text-white">Official Fan Card + QR</span>
            </div>
          </div>

          <div className="mt-6 flex items-end justify-between border-t border-white/15 pt-5">
            <span className="text-sm text-white/70">Total due today</span>
            <span className="text-3xl font-black">{total}</span>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-white/55">
            Secured by Stripe. Your card details are encrypted end-to-end.
          </p>
        </div>
      </div>

      {/* Payment form */}
      <form onSubmit={submit} className="glass rounded-3xl p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Payment Details</p>
        <h2 className="mt-1 text-xl font-black tracking-tight">Pay with card</h2>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Cardholder Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="Name on card"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Card Number</label>
            <input
              required
              inputMode="numeric"
              value={number}
              onChange={(e) => setNumber(formatCardNumber(e.target.value))}
              className={`${inputCls} font-mono`}
              placeholder="4242 4242 4242 4242"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Expiry</label>
              <input
                required
                inputMode="numeric"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                className={`${inputCls} font-mono`}
                placeholder="MM/YY"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-300">CVC</label>
              <input
                required
                inputMode="numeric"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className={`${inputCls} font-mono`}
                placeholder="123"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs leading-relaxed text-zinc-500">
            Secured by Stripe. Your payment is encrypted end-to-end.
          </p>
          <button
            type="submit"
            disabled={processing}
            className="btn-grad shrink-0 rounded-full px-8 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {processing ? "Processing…" : `Pay ${total}`}
          </button>
        </div>
      </form>
    </div>
  );
}