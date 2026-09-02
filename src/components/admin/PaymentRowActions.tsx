"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PaymentRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const refund = async () => {
    if (!confirm("Refund this payment? The fan keeps their card but the order is marked refunded.")) return;
    setBusy(true);
    const res = await fetch(`/api/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REFUND" }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Refund failed.");
  };

  if (status !== "PAID") {
    return <span className="text-xs text-zinc-600">—</span>;
  }

  return (
    <button
      disabled={busy}
      onClick={refund}
      className="rounded-full px-3 py-1.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/20 transition hover:text-amber-200 disabled:opacity-50"
    >
      Refund
    </button>
  );
}