"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type FwStatus = {
  enabled: boolean;
  environment: "test" | "live" | "";
  secretKeyConfigured: boolean;
  secretKeyLast4: string;
  secretKeySource: "db" | "env" | "";
  publicKeyConfigured: boolean;
  publicKeyLast4: string;
  publicKeySource: "db" | "env" | "";
  webhookHashConfigured: boolean;
  webhookHashLast4: string;
  webhookHashSource: "db" | "env" | "";
  ready: boolean;
};

type SettingsResponse = { settings?: FwStatus | null; error?: string; message?: string };

export default function AtmCardConfig() {
  const [status, setStatus] = useState<FwStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/payment-settings", { cache: "no-store" });
      if (res.status === 401) {
        window.location.assign("/admin/login");
        return;
      }
      if (!res.ok) throw new Error(res.status === 503 ? "Could not read processor state." : `HTTP ${res.status}`);
      const data = (await res.json()) as SettingsResponse;
      if (data.error === "settings_unavailable") throw new Error(data.message ?? "Could not read processor state.");
      setStatus(data.settings ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load processor status.");
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const ready = status?.ready ?? false;

  return (
    <div className="space-y-5">
      <div
        className={`rounded-2xl border p-4 ${
          ready ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" : "border-amber-400/25 bg-amber-400/10 text-amber-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${ready ? "bg-emerald-400" : "bg-amber-400"}`} />
          <p className="text-sm font-black">
            {ready ? "Connected — Flutterwave card payments are live." : "Not fully configured yet."}
          </p>
        </div>
        <p className="mt-1.5 text-xs leading-5 opacity-90">
          Every card payment on this site — fan-card membership <em>and</em> event-ticket orders — is processed through
          Flutterwave V3&apos;s hosted checkout. Card numbers are collected only on Flutterwave&apos;s own secure page and
          never reach this server. Bank Transfer remains the other method.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error} <button onClick={() => void load()} className="ml-2 underline">Retry</button>
        </div>
      )}

      {!status && !error && <p className="text-sm text-zinc-400">Loading Flutterwave connection status…</p>}

      {status && (
        <div className="glass rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-white">Flutterwave connection</h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                Credentials live in the database and are managed on the{" "}
                <Link href="/admin/payment-settings" className="text-primary-300 underline">Payment Settings page</Link>.
              </p>
            </div>
            <Link
              href="/admin/payment-settings"
              className="rounded-full bg-primary-500/20 px-4 py-2 text-xs font-bold text-primary-200 ring-1 ring-primary-400/30 transition hover:bg-primary-500/30"
            >
              Edit Flutterwave keys →
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <KeyRow label="Enabled" ok={status.enabled} value={status.enabled ? "true" : "false"} />
            <KeyRow label="Environment" ok={Boolean(status.environment)} value={status.environment || "—"} />
            <KeyRow label="Secret key" ok={status.secretKeyConfigured} value={status.secretKeyConfigured ? status.secretKeyLast4 : "not set"} source={status.secretKeySource} />
            <KeyRow label="Public key" ok={status.publicKeyConfigured} value={status.publicKeyConfigured ? status.publicKeyLast4 : "not set"} source={status.publicKeySource} />
            <KeyRow label="Webhook secret hash" ok={status.webhookHashConfigured} value={status.webhookHashConfigured ? status.webhookHashLast4 : "not set"} source={status.webhookHashSource} />
            <KeyRow label="Ready for card payments" ok={ready} value={ready ? "yes" : "no"} />
          </div>

          <p className="mt-4 rounded-xl bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-zinc-500 ring-1 ring-white/10">
            Webhook URL for the Flutterwave dashboard: <code className="text-zinc-300">/api/payments/flutterwave/webhook</code> — it must point to your
            site&apos;s domain. The webhook settles every card purchase after a server-side verification; the callback page only shows progress.
          </p>
        </div>
      )}
    </div>
  );
}

function KeyRow({ label, ok, value, source }: { label: string; ok: boolean; value: string; source?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-zinc-300">
          <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`} />
          {label}
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">{value}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ok ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-500"}`}>
          {ok ? "Set" : "Missing"}
        </span>
        {source ? <span className="text-[10px] text-zinc-600">{source}</span> : null}
      </div>
    </div>
  );
}