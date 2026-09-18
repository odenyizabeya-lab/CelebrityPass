"use client";

import { useState } from "react";

type KycRecord = {
  legalFullName?: string | null;
  documentType?: string | null;
  country?: string | null;
};

export default function KycForm({ kycStatus, existing }: { kycStatus: string; existing: KycRecord | null }) {
  const [legalFullName, setLegalFullName] = useState(existing?.legalFullName ?? "");
  const [documentType, setDocumentType] = useState(existing?.documentType ?? "");
  const [country, setCountry] = useState(existing?.country ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (kycStatus === "VERIFIED") {
    return <p className="mt-3 text-sm text-emerald-400">Your identity is verified.</p>;
  }
  if (kycStatus === "PENDING" || kycStatus === "UNDER_REVIEW") {
    return <p className="mt-3 text-sm text-zinc-400">Your submission is under review by an administrator.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/invest/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalFullName, documentType, country }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Submission failed.");
        return;
      }
      setOk("Submitted. An administrator will review your identity.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <div>
        <label className="block text-sm text-zinc-400">
          Legal full name
          <input value={legalFullName} onChange={(e) => setLegalFullName(e.target.value)} required className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-zinc-400">
          Document type
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} required className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500">
            <option value="">Select…</option>
            <option>PASSPORT</option>
            <option>NATIONAL_ID</option>
            <option>DRIVERS_LICENSE</option>
          </select>
        </label>
        <label className="block text-sm text-zinc-400">
          Country of residence
          <input value={country} onChange={(e) => setCountry(e.target.value)} required className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-primary-500" />
        </label>
      </div>
      <p className="text-xs text-zinc-600">Document upload and secure storage are listed as a gap behind a licensed KYC/AML provider before real money.</p>
      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-400">{error}</p>}
      {ok && <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{ok}</p>}
      <button type="submit" disabled={busy} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {busy ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}