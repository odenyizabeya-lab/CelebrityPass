"use client";

import { useEffect, useState } from "react";

type ConfigStatus = {
  publicKeyEnv: string;
  secretKeyEnv: string;
  publicKey: boolean;
  secretKey: boolean;
  gatewayRegistered: boolean;
  connected: boolean;
};

export default function AtmCardConfig() {
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tickets/admin/atm-card")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setStatus)
      .catch(() => setError("Could not load ATM Card config status."));
  }, []);

  if (error) return <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>;

  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm text-zinc-400">
        ATM Card payments are only active after you connect a real card processor. Until then customers are honestly told
        the option isn&apos;t available and are directed to Bank Transfer — nothing is ever faked.
      </p>

      {status ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <ConfigRow label="Gateway registered" ok={status.gatewayRegistered} />
            <ConfigRow label="Public key set" ok={status.publicKey} />
            <ConfigRow label="Secret key set" ok={status.secretKey} />
            <ConfigRow label="Connected & taking card payments" ok={status.connected} />
          </div>

          {!status.connected && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-4 text-sm text-amber-200/90">
              <p className="font-semibold">Payment provider not connected yet.</p>
              <p className="mt-1 leading-relaxed">
                Set <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-amber-100">{status.publicKeyEnv}</code>{" "}
                and <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-amber-100">{status.secretKeyEnv}</code>{" "}
                in <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono">.env</code> and register the corresponding
                gateway to enable it. The public key may be used client-side; the secret key is read server-side only and is
                never stored in the database.
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">Loading config status…</p>
      )}
    </div>
  );
}

function ConfigRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
      <span className="text-sm text-zinc-300">{label}</span>
      <span className={`ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${ok ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-500"}`}>
        {ok ? "Yes" : "No"}
      </span>
    </div>
  );
}