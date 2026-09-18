"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Opportunity = {
  id: string;
  slug: string;
  name: string;
  companyName: string | null;
  investmentType: string;
  status: string;
  minAmount: string | null;
  maxAmount: string | null;
  targetAmount: string | null;
  raisedAmount: string;
  currency: string;
};

const STATUSES = ["DRAFT", "PENDING", "OPEN", "PAUSED", "CLOSED", "CANCELLED"];

export default function AdminInvestOpportunitiesPage() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const formState = useFormState();

  function load() {
    fetch("/api/admin/invest/opportunities")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((d) => setOpps(d.opportunities))
      .catch(() => setError("Could not load opportunities."));
  }
  useEffect(load, []);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invest/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Update failed.");
        return;
      }
      load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const f = formState;
    try {
      const res = await fetch("/api/admin/invest/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name,
          companyName: f.companyName,
          investmentType: f.investmentType,
          description: f.description,
          status: f.status,
          currency: f.currency,
          minAmount: f.minAmount,
          maxAmount: f.maxAmount,
          targetAmount: f.targetAmount,
          risksText: f.risksText,
          expectedReturnText: f.expectedReturnText,
          liquidityText: f.liquidityText,
          linkedCelebrityId: f.linkedCelebrityId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Create failed.");
        return;
      }
      formState.reset();
      load();
    } catch {
      setError("Could not reach the server.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-white">Opportunities</h1>
        <Link href="/admin/invest" className="text-sm text-zinc-400 hover:text-white">← Investor overview</Link>
      </div>
      {error && <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-400">{error}</p>}

      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="font-extrabold text-white">Create opportunity</h2>
        <form onSubmit={create} className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Name">
            <input required className={inputCls} value={formState.name} onChange={(e) => formState.set("name", e.target.value)} />
          </Field>
          <Field label="Company name">
            <input className={inputCls} value={formState.companyName ?? ""} onChange={(e) => formState.set("companyName", e.target.value)} />
          </Field>
          <Field label="Investment type">
            <select className={inputCls} value={formState.investmentType} onChange={(e) => formState.set("investmentType", e.target.value)}>
              <option>PRIVATE_EQUITY</option>
              <option>VENTURE_CAPITAL</option>
              <option>REAL_ESTATE</option>
              <option>ARTWORK</option>
              <option>OTHER</option>
            </select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={formState.status} onChange={(e) => formState.set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Currency">
            <input className={inputCls} value={formState.currency} onChange={(e) => formState.set("currency", e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Min $"><input className={inputCls} value={formState.minAmount} onChange={(e) => formState.set("minAmount", e.target.value)} /></Field>
            <Field label="Max $"><input className={inputCls} value={formState.maxAmount} onChange={(e) => formState.set("maxAmount", e.target.value)} /></Field>
            <Field label="Target $"><input className={inputCls} value={formState.targetAmount} onChange={(e) => formState.set("targetAmount", e.target.value)} /></Field>
          </div>
          <Field label="Description">
            <textarea className={inputCls} rows={2} value={formState.description ?? ""} onChange={(e) => formState.set("description", e.target.value)} />
          </Field>
          <Field label="Risks">
            <textarea className={inputCls} rows={2} value={formState.risksText ?? ""} onChange={(e) => formState.set("risksText", e.target.value)} />
          </Field>
          <Field label="Expected return">
            <input className={inputCls} value={formState.expectedReturnText ?? ""} onChange={(e) => formState.set("expectedReturnText", e.target.value)} />
          </Field>
          <Field label="Liquidity">
            <input className={inputCls} value={formState.liquidityText ?? ""} onChange={(e) => formState.set("liquidityText", e.target.value)} />
          </Field>
          <Field label="Linked celebrity id (optional)">
            <input className={inputCls} value={formState.linkedCelebrityId ?? ""} onChange={(e) => formState.set("linkedCelebrityId", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-full bg-primary-600 px-6 py-2.5 font-bold text-white hover:bg-primary-500">Create</button>
          </div>
        </form>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-widest text-zinc-500">
              <th className="px-4 py-3">Opportunity</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Raised</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {opps.map((o) => (
              <tr key={o.id} className="border-b border-zinc-800/60 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-bold text-white">{o.name}</p>
                  <p className="text-xs text-zinc-500">{o.slug}</p>
                </td>
                <td className="px-4 py-3 text-zinc-300">{o.investmentType.replaceAll("_", " ")}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${o.status === "OPEN" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>{o.status}</span>
                </td>
                <td className="px-4 py-3 text-zinc-300">${Number(o.raisedAmount ?? 0).toFixed(2)} {o.currency}</td>
                <td className="px-4 py-3">
                  <select
                    value={o.status}
                    disabled={busy === o.id}
                    onChange={(e) => setStatus(o.id, e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-300 outline-none focus:border-primary-500"
                  >
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {opps.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No opportunities yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function useFormState() {
  const [s, setS] = useState({
    name: "", companyName: "", investmentType: "PRIVATE_EQUITY", description: "", status: "DRAFT", currency: "USD",
    minAmount: "", maxAmount: "", targetAmount: "", risksText: "", expectedReturnText: "", liquidityText: "", linkedCelebrityId: "",
  });
  return {
    ...s,
    set: (k: keyof typeof s, v: string) => setS((p) => ({ ...p, [k]: v })),
    reset: () => setS({ name: "", companyName: "", investmentType: s.investmentType, description: "", status: "DRAFT", currency: "USD", minAmount: "", maxAmount: "", targetAmount: "", risksText: "", expectedReturnText: "", liquidityText: "", linkedCelebrityId: "" }),
  };
}

const inputCls = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-primary-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-zinc-400">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}