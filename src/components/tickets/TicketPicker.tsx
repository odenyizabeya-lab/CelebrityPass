"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatTicketPrice, clampQuantity } from "@/lib/ticketing/helpers";
import { inventoryStatusLabel } from "@/lib/ticketing/types";
import type { TicketOptionPublic } from "@/lib/ticketing/service";

export default function TicketPicker({
  eventId,
  eventName,
  tickets,
}: {
  eventId: string;
  eventName: string;
  tickets: TicketOptionPublic[];
}) {
  const router = useRouter();
  const sellable = tickets.filter((t) => t.sellable);
  const [selectedId, setSelectedId] = useState<string | null>(sellable[0]?.inventoryId ?? null);
  const [qty, setQty] = useState(1);

  const selected = sellable.find((t) => t.inventoryId === selectedId) ?? null;

  const maxQty = selected ? clampQuantity(8, selected.quantityAvailable) : 1;

  const summary = selected
    ? {
        subtotal: selected.priceCents * qty,
        fees: selected.feesCents * qty,
        total: (selected.priceCents + selected.feesCents) * qty,
        currency: selected.currency,
      }
    : null;

  function goToCheckout() {
    if (!selected) return;
    router.push(`/checkout?eventId=${encodeURIComponent(eventId)}&sel=${encodeURIComponent(`${selected.inventoryId}:${qty}`)}`);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        {sellable.map((t) => {
          const active = t.inventoryId === selectedId;
          return (
            <button
              key={t.inventoryId}
              onClick={() => setSelectedId(t.inventoryId)}
              className={`glass w-full rounded-2xl p-5 text-left transition ${
                active ? "ring-2 ring-primary-400" : "ring-1 ring-white/10 hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-white">{t.name}</p>
                  <p className="mt-0.5 text-sm text-zinc-400">
                    {[t.category, inventoryStatusLabel(t.status)].filter(Boolean).join(" · ") || "Ticket"}
                  </p>
                    {t.quantityAvailable != null && (
                      <p className="mt-1 text-xs text-zinc-500">{t.quantityAvailable} available as last reported</p>
                    )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-white">{formatTicketPrice(t.priceCents, t.currency)}</p>
                  <p className="text-xs text-zinc-400">
                    {t.feesCents > 0 ? `+ ${formatTicketPrice(t.feesCents, t.currency)} fees` : "no fees listed"}
                  </p>
                </div>
              </div>
              {t.url && (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 inline-block rounded-full px-4 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/5"
                >
                  Buy at official seller ↗
                </a>
              )}
            </button>
          );
        })}

        {sellable.length === 0 && (
          <p className="rounded-2xl bg-zinc-800/40 px-5 py-6 text-sm text-zinc-400 ring-1 ring-white/10">
            No tickets are currently available to select. Please check the event page for the official ticket source.
          </p>
        )}
      </div>

      {/* Order summary */}
      <aside className="lg:sticky lg:top-24">
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Your order</h3>
          <p className="mt-2 text-lg font-bold text-white">{eventName}</p>

          {selected && summary ? (
            <>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{selected.name}</p>
                  <p className="text-xs text-zinc-500">{formatTicketPrice(selected.priceCents, selected.currency)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <QtyButton disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} label="−" />
                  <span className="w-8 text-center font-mono text-lg font-black text-white">{qty}</span>
                  <QtyButton disabled={qty >= maxQty} onClick={() => setQty((q) => Math.min(maxQty, q + 1))} label="+" />
                </div>
              </div>

              <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
                <div className="flex justify-between text-zinc-300">
                  <dt>Subtotal</dt>
                  <dd>{formatTicketPrice(summary.subtotal, summary.currency)}</dd>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <dt>Fees</dt>
                  <dd>{formatTicketPrice(summary.fees, summary.currency)}</dd>
                </div>
                <div className="flex justify-between text-lg font-black text-white">
                  <dt>Total</dt>
                  <dd>{formatTicketPrice(summary.total, summary.currency)}</dd>
                </div>
              </dl>

              <button
                onClick={goToCheckout}
                className="btn-grad mt-5 w-full rounded-full py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue to checkout →
              </button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
                Prices and fees are as reported by the official ticket source. Your order is confirmed only after a successful payment.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-zinc-400">Select a ticket type to see your total.</p>
          )}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
          Want to buy direct? Check the event page for the official ticket source link.
        </p>
      </aside>
    </div>
  );
}

function QtyButton({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-lg font-black text-white ring-1 ring-white/10 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {label}
    </button>
  );
}