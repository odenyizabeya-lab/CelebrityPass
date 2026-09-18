"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Overview = {
  mode: string;
  isDemo: boolean;
  counts: { investors: number; pendingKyc: number; pendingWithdrawals: number; openOpportunities: number; activePositions: number; openAlerts: number };
  aum: { cash: string; invested: string; total: string; currency: string };
};

export default function AdminInvestPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/invest/overview")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Unauthorized or failed")))
      )
      .then((d: Overview) => alive && setData(d))
      .catch((e) => alive && setError(String(e.message ?? e)));
    return () => {
      alive = false;
    };
  }, []);

  const c = data?.counts;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Investor Platform</h1>
          <p className="mt-1 text-sm text-zinc-400">{data ? `Mode: ${data.mode}` : "Loading…"}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/invest/opportunities" className="rounded-full bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-500">Opportunities</Link>
          <Link href="/admin/invest/investors" className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800">Investors</Link>
          <Link href="/admin/invest/withdrawals" className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800">Withdrawals</Link>
          <Link href="/admin/invest/alerts" className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800">Alerts</Link>
        </div>
      </div>

      {error && <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-400">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Investor accounts" value={c ? c.investors : "—"} />
        <Stat label="Pending KYC" value={c ? c.pendingKyc : "—"} />
        <Stat label="Pending withdrawals" value={c ? c.pendingWithdrawals : "—"} />
        <Stat label="Open opportunities" value={c ? c.openOpportunities : "—"} />
        <Stat label="Active positions" value={c ? c.activePositions : "—"} />
        <Stat label="Open compliance alerts" value={c ? c.openAlerts : "—"} />
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="text-lg font-extrabold text-white">Assets under management (ledger-derived)</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <Stat label="Cash" value={data ? `$${data.aum.cash}` : "—"} />
          <Stat label="Invested" value={data ? `$${data.aum.invested}` : "—"} />
          <Stat label="Total" value={data ? `$${data.aum.total}` : "—"} />
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          Every number above is computed from the double-entry ledger. No field is ever typed in by the product. In demo
          mode all money is simulated — go live only after the external requirements checklist is met.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}