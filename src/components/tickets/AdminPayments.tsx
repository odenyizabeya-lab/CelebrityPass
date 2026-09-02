"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Method = {
  id: string;
  key: string;
  name: string;
  kind: string;
  isEnabled: boolean;
  isDefault: boolean;
  currency: string;
  credentialEnvKeys: string[];
  hasCredentials: boolean;
  hasSettlementAccount: boolean;
  settlementAccountLabel: string | null;
  settlementAccountLast4: string | null;
};
type Settlement = {
  id: string;
  amountCents: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  reference: string | null;
  note: string | null;
  paymentMethodName: string | null;
  createdAt: string;
};

function resetMethod(): Method {
  return {
    id: "",
    key: "",
    name: "",
    kind: "CARD",
    isEnabled: true,
    isDefault: false,
    currency: "USD",
    credentialEnvKeys: [],
    hasCredentials: false,
    hasSettlementAccount: false,
    settlementAccountLabel: null,
    settlementAccountLast4: null,
  };
}

export default function AdminPayments({ methods, settlements }: { methods: Method[]; settlements: Settlement[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Method>(resetMethod());
  const [envKeyInput, setEnvKeyInput] = useState("");
  const [settlementAccountEnvKey, setSettlementAccountEnvKey] = useState("");
  const [settlementLabel, setSettlementLabel] = useState("");
  const [settlementLast4, setSettlementLast4] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newSettlement, setNewSettlement] = useState({ paymentMethodId: "", amountCents: "", periodStart: "", periodEnd: "", reference: "", note: "" });

  async function createMethod() {
    setError(null);
    if (!draft.key.trim() || !draft.name.trim()) {
      setError("Key and name are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tickets/admin/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: draft.key.trim(),
          name: draft.name.trim(),
          kind: draft.kind,
          isEnabled: draft.isEnabled,
          isDefault: draft.isDefault,
          currency: draft.currency || "USD",
          credentialEnvKeys: envKeyInput.split(",").map((v) => v.trim()).filter(Boolean),
          settlementAccountEnvKey: settlementAccountEnvKey.trim() || undefined,
          settlementAccountLabel: settlementLabel.trim() || undefined,
          settlementAccountLast4: settlementLast4.trim() || undefined,
          notes: undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the payment method.");
      setDraft(resetMethod());
      setEnvKeyInput("");
      setSettlementAccountEnvKey("");
      setSettlementLabel("");
      setSettlementLast4("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the payment method.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(m: Method) {
    setError(null);
    await fetch(`/api/tickets/admin/payment-methods/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !m.isEnabled }),
    }).then((r) => r.ok);
    router.refresh();
  }

  async function toggleDefault(m: Method) {
    setError(null);
    await fetch(`/api/tickets/admin/payment-methods/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: !m.isDefault }),
    }).then((r) => r.ok);
    router.refresh();
  }

  async function deleteM(m: Method) {
    setError(null);
    await fetch(`/api/tickets/admin/payment-methods/${m.id}`, { method: "DELETE" }).then((r) => r.ok);
    router.refresh();
  }

  async function addSettlement() {
    setError(null);
    if (!newSettlement.paymentMethodId || !newSettlement.amountCents) {
      setError("Choose a method and enter an amount.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tickets/admin/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodId: newSettlement.paymentMethodId,
          amountCents: Math.round(Number(newSettlement.amountCents)),
          periodStart: newSettlement.periodStart || null,
          periodEnd: newSettlement.periodEnd || null,
          reference: newSettlement.reference || null,
          note: newSettlement.note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add settlement.");
      setNewSettlement({ paymentMethodId: "", amountCents: "", periodStart: "", periodEnd: "", reference: "", note: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add settlement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Create / methods */}
      <section className="rounded-2xl ring-1 ring-white/10 bg-white/[0.02] p-5">
        <p className="text-sm font-black uppercase tracking-widest text-zinc-500">Payment methods</p>
        <p className="mt-1 text-xs text-zinc-500">
          Only give env-var <em>names</em>, never values. A method is placeable in checkout once credentials exist on the server.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="key (e.g. stripe)" className={inputCls} />
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name (e.g. Stripe)" className={inputCls} />
          <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className={inputCls}>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="WALLET">Wallet</option>
          </select>
          <input value={draft.currency || "USD"} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} placeholder="Currency" className={inputCls} />
        </div>
        <input
          value={envKeyInput}
          onChange={(e) => setEnvKeyInput(e.target.value)}
          placeholder="Credential env var names, comma-separated (e.g. STRIPE_SECRET_KEY)"
          className={`${inputCls} mt-3`}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input value={settlementAccountEnvKey} onChange={(e) => setSettlementAccountEnvKey(e.target.value)} placeholder="Settlement account env key (optional)" className={inputCls} />
          <input value={settlementLabel} onChange={(e) => setSettlementLabel(e.target.value)} placeholder="Settlement account label (optional)" className={inputCls} />
          <input value={settlementLast4} onChange={(e) => setSettlementLast4(e.target.value)} placeholder="Account last 4 (masked, optional)" className={inputCls} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
          <input type="checkbox" checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })} />
          Default method in checkout
        </label>
        {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-400/20">{error}</p>}
        <button onClick={createMethod} disabled={busy} className="btn-grad mt-4 rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {busy ? "Saving…" : "Add payment method"}
        </button>

        <div className="mt-6 space-y-2">
          {methods.length === 0 && <p className="text-sm text-zinc-500">No payment methods yet.</p>}
          {methods.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
              <div className="min-w-0">
                <p className="font-semibold text-white">
                  {m.name}<span className="ml-2 rounded bg-white/5 px-2 py-0.5 text-[10px] uppercase text-zinc-400 ring-1 ring-white/10">{m.kind}</span>
                  {m.isDefault && <span className="ml-2 rounded bg-primary-500/20 px-2 py-0.5 text-[10px] uppercase text-primary-300 ring-1 ring-primary-400/30">default</span>}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {m.credentialEnvKeys.join(", ") || "no env vars"} · {m.currency} ·
                  {m.hasCredentials ? (
                    <span className="text-emerald-300"> credentials present</span>
                  ) : (
                    <span className="text-zinc-400"> no credentials</span>
                  )}
                  {m.settlementAccountLabel && <> · {m.settlementAccountLabel}{m.settlementAccountLast4 ? ` ·•${m.settlementAccountLast4}` : ""}</>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggle(m)} className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${m.isEnabled ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" : "bg-white/5 text-zinc-400 ring-white/15"}`}>
                  {m.isEnabled ? "Enabled" : "Disabled"}
                </button>
                {!m.isDefault && (
                  <button onClick={() => toggleDefault(m)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-300 ring-1 ring-white/15 hover:bg-white/5">
                    Set default
                  </button>
                )}
                <button onClick={() => deleteM(m)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-400/30 hover:bg-rose-500/10">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Settlement records */}
      <section className="mt-6 rounded-2xl ring-1 ring-white/10 bg-white/[0.02] p-5">
        <p className="text-sm font-black uppercase tracking-widest text-zinc-500">Settlement records</p>
        <p className="mt-1 text-xs text-zinc-500">A record of funds transferred from a payment provider to the settlement account.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <select value={newSettlement.paymentMethodId} onChange={(e) => setNewSettlement({ ...newSettlement, paymentMethodId: e.target.value })} className={inputCls}>
            <option value="">Method…</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id} className="bg-zinc-900">{m.name}</option>
            ))}
          </select>
          <input value={newSettlement.amountCents} onChange={(e) => setNewSettlement({ ...newSettlement, amountCents: e.target.value })} placeholder="Amount (cents)" type="number" className={inputCls} />
          <input value={newSettlement.periodStart} onChange={(e) => setNewSettlement({ ...newSettlement, periodStart: e.target.value })} placeholder="Period start (YYYY-MM-DD)" className={inputCls} />
          <input value={newSettlement.periodEnd} onChange={(e) => setNewSettlement({ ...newSettlement, periodEnd: e.target.value })} placeholder="Period end" className={inputCls} />
          <input value={newSettlement.reference} onChange={(e) => setNewSettlement({ ...newSettlement, reference: e.target.value })} placeholder="Reference" className={inputCls} />
          <input value={newSettlement.note} onChange={(e) => setNewSettlement({ ...newSettlement, note: e.target.value })} placeholder="Note" className={inputCls} />
        </div>
        <button onClick={addSettlement} disabled={busy} className="btn-grad mt-3 rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {busy ? "Adding…" : "Add settlement"}
        </button>

        <div className="mt-6 space-y-2">
          {settlements.length === 0 && <p className="text-sm text-zinc-500">No settlement records yet.</p>}
          {settlements.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10 text-sm">
              <div>
                <p className="font-semibold text-white">{formatCents(s.amountCents, s.currency)}</p>
                <p className="text-xs text-zinc-500">
                  {s.paymentMethodName} · {s.periodStart && `from ${s.periodStart}`}{s.periodEnd && ` to ${s.periodEnd}`} · {new Date(s.createdAt).toLocaleString()}
                </p>
                {s.reference && <p className="mt-0.5 text-xs text-zinc-400">Ref: <span className="font-mono">{s.reference}</span></p>}
                {s.note && <p className="mt-0.5 text-xs text-zinc-400">{s.note}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatCents(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);
}

const inputCls =
  "rounded-xl bg-white/[0.04] px-4 py-2.5 text-sm text-white ring-1 ring-white/10 outline-none transition placeholder:text-zinc-600 focus:ring-2 focus:ring-primary-400";