"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Investor = {
  id: string;
  investorNumber: string;
  legalFullName: string | null;
  country: string | null;
  kycStatus: string;
  accountStatus: string;
  riskFlag: string | null;
  email: string;
  kycLegalName: string | null;
  submittedAt: string | null;
  createdAt: string;
};

const DECISIONS = ["VERIFIED", "REJECTED", "ADDITIONAL_INFORMATION_REQUIRED"] as const;

export default function AdminInvestInvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    fetch(`/api/admin/invest/investors${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((d) => setInvestors(d.investors))
      .catch(() => setError("Could not load investors."));
  }
  useEffect(load, [q]);

  async function decide(id: string, decision: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invest/kyc/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Decision failed.");
        return;
      }
      load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-white">Investors</h1>
        <Link href="/admin/invest" className="text-sm text-zinc-400 hover:text-white">← Investor overview</Link>
      </div>

      <input
        placeholder="Search by email, account number or name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-white outline-none focus:border-primary-500 sm:max-w-md"
      />
      {error && <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-400">{error}</p>}

      <div className="overflow-x-auto rounded-3xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-widest text-zinc-500">
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">KYC</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Decision</th>
            </tr>
          </thead>
          <tbody>
            {investors.map((inv) => (
              <tr key={inv.id} className="border-b border-zinc-800/60 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-bold text-white">{inv.investorNumber}</p>
                  <p className="text-xs text-zinc-500">{inv.email}</p>
                </td>
                <td className="px-4 py-3 text-zinc-300">{inv.kycLegalName ?? inv.legalFullName ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-300">{inv.country ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${inv.kycStatus === "VERIFIED" ? "bg-emerald-500/15 text-emerald-400" : inv.kycStatus === "PENDING" ? "bg-amber-500/15 text-amber-400" : "bg-zinc-800 text-zinc-400"}`}>{inv.kycStatus}</span>
                </td>
                <td className="px-4 py-3 text-zinc-400">{inv.submittedAt ? new Date(inv.submittedAt).toLocaleString() : "—"}</td>
                <td className="px-4 py-3">
                  {inv.kycStatus === "PENDING" || inv.kycStatus === "UNDER_REVIEW" ? (
                    <div className="flex gap-1.5">
                      {DECISIONS.map((d) => (
                        <button
                          key={d}
                          disabled={busy === inv.id}
                          onClick={() => decide(inv.id, d)}
                          className={decCls(d)}
                        >
                          {d === "VERIFIED" ? "Verify" : d === "REJECTED" ? "Reject" : "Ask more"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500">
                      {inv.riskFlag ? `Risk flag: ${inv.riskFlag}` : "No pending review"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {investors.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No investors found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function decCls(d: string): string {
  const base = "rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ";
  if (d === "VERIFIED") return base + "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25";
  if (d === "REJECTED") return base + "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25";
  return base + "bg-zinc-800 text-zinc-300 hover:bg-zinc-700";
}