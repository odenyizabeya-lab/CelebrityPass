"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTicketPrice } from "@/lib/ticketing/helpers";
import type { TicketOptionPublic } from "@/lib/ticketing/service";

export type CheckoutSelection = { inventoryId: string; quantity: number };

export default function CheckoutForm({
  eventId,
  eventName,
  tickets,
  selection,
  officialTicketUrl,
  paymentMethods,
}: {
  eventId: string;
  eventName: string;
  tickets: TicketOptionPublic[];
  selection: CheckoutSelection[];
  officialTicketUrl: string | null;
  paymentMethods: { id: string; name: string; kind: string; isDefault: boolean }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState<string>(paymentMethods[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(() => {
    return selection
      .map((s) => ({ opt: tickets.find((t) => t.inventoryId === s.inventoryId), qty: s.quantity }))
      .filter((l): l is { opt: TicketOptionPublic; qty: number } => Boolean(l.opt));
  }, [selection, tickets]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + l.opt.priceCents * l.qty, 0);
    const fees = lines.reduce((sum, l) => sum + l.opt.feesCents * l.qty, 0);
    return { subtotal, fees, total: subtotal + fees, currency: lines[0]?.opt.currency ?? "USD" };
  }, [lines]);

  async function placeOrder() {
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError("Please enter your name and email.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tickets/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          items: lines.map((l) => ({ inventoryId: l.opt.inventoryId, quantity: l.qty })),
          customer: { name, email, phone, country },
          paymentMethodId: paymentMethodId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not place the order.");
      router.push(`/order/${data.orderRef}?t=${data.token}&created=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place the order.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      {/* Customer + payment */}
      <div className="space-y-6">
        <section className="glass rounded-2xl p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Contact information</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Your name" autoComplete="name" />
            </Field>
            <Field label="Email" required>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} type="email" placeholder="you@example.com" autoComplete="email" />
            </Field>
            <Field label="Phone (optional)">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+1 555 000 0000" autoComplete="tel" />
            </Field>
            <Field label="Country (optional)">
              <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} placeholder="Country" autoComplete="country-name" />
            </Field>
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Pay with</h3>
          {paymentMethods.length === 0 ? (
            <div className="mt-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90 ring-1 ring-amber-400/20">
              No payment method is configured on this site yet. Your order will be saved as <strong>awaiting payment</strong>{" "}
              {officialTicketUrl ? (
                <>
                  — you can complete it at the official ticket source:{" "}
                  <a href={officialTicketUrl} target="_blank" rel="noreferrer" className="underline hover:text-white">
                    {new URL(officialTicketUrl).hostname} ↗
                  </a>
                </>
              ) : (
                "once an authorized payment method is set up."
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {paymentMethods.map((m) => {
                const active = m.id === paymentMethodId;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethodId(m.id)}
                    className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-white ring-1 transition ${
                      active ? "bg-white/10 ring-primary-400" : "bg-white/[0.03] ring-white/10 hover:bg-white/5"
                    }`}
                  >
                    {m.name}
                    {m.isDefault && <span className="ml-2 text-[10px] uppercase tracking-widest text-zinc-400">default</span>}
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
            Your card is issued only after the payment is successfully processed by the connected gateway. We never store your payment
            details in the browser.
          </p>
        </section>

        {error && <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-400/20">{error}</p>}

        <button
          onClick={placeOrder}
          disabled={busy}
          className="btn-grad w-full rounded-full py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Placing order…" : "Review & place order"}
        </button>
        <p className="text-center text-[11px] text-zinc-500">
          Placing an order does not charge you and is not a confirmation. Confirmation happens only after a successful payment.
        </p>
      </div>

      {/* Order review */}
      <aside className="lg:sticky lg:top-24">
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Order review</h3>
          <p className="mt-2 text-lg font-bold text-white">{eventName}</p>
          <div className="mt-4 space-y-3">
            {lines.map((l) => (
              <div key={l.opt.inventoryId} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-semibold text-white">
                    {l.opt.name} <span className="text-zinc-400">× {l.qty}</span>
                  </p>
                  <p className="text-xs text-zinc-500">{formatTicketPrice(l.opt.priceCents, l.opt.currency)} each</p>
                </div>
                <p className="font-bold text-white">{formatTicketPrice(l.opt.priceCents * l.qty, l.opt.currency)}</p>
              </div>
            ))}
          </div>
          <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
            <div className="flex justify-between text-zinc-300">
              <dt>Subtotal</dt>
              <dd>{formatTicketPrice(totals.subtotal, totals.currency)}</dd>
            </div>
            <div className="flex justify-between text-zinc-300">
              <dt>Fees</dt>
              <dd>{formatTicketPrice(totals.fees, totals.currency)}</dd>
            </div>
            <div className="flex justify-between text-lg font-black text-white">
              <dt>Total</dt>
              <dd>{formatTicketPrice(totals.total, totals.currency)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
            Amounts are as last reported by the ticket source. Final charges happen only when payment is processed.
          </p>
        </div>
      </aside>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-white ring-1 ring-white/10 outline-none transition placeholder:text-zinc-600 focus:ring-2 focus:ring-primary-400";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-400">
        {label}
        {required ? " *" : ""}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}