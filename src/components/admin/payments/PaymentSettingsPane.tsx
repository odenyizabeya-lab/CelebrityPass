"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500";
const errCls = "mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300";
const okCls = "mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300";

type Status = {
  enabled: boolean;
  environment: "test" | "live" | "";
  clientId: string;
  clientIdConfigured: boolean;
  clientIdLast4: string;
  clientIdSource: "db" | "env" | "";
  clientSecretConfigured: boolean;
  clientSecretLast4: string;
  clientSecretSource: "db" | "env" | "";
  webhookHashConfigured: boolean;
  webhookHashLast4: string;
  webhookHashSource: "db" | "env" | "";
  apiBaseUrl: string;
  webhookUrl: string;
  encryptionEnabled: boolean;
  ready: boolean;
};

type LoadResult = { status: Status } | { error: string; unauthorized?: boolean };

/**
 * Fetch the authoritative saved processor state. Failures are surfaced as an
 * explicit error (never as a clean "disabled" reading), so a transient
 * network/DB/auth hiccup can't make the UI look OFF and overwrite the real
 * saved value.
 */
async function fetchStatus(): Promise<LoadResult> {
  try {
    const res = await fetch("/api/admin/payment-settings", { cache: "no-store" });
    if (res.status === 401) {
      return { error: "Your admin session expired.", unauthorized: true };
    }
    if (res.status === 503) {
      return { error: "Could not read the saved processor state right now. No changes were made — reload to try again." };
    }
    if (!res.ok) {
      return { error: `Could not load processor settings (HTTP ${res.status}).` };
    }
    const d = await res.json();
    if (!d.settings) {
      return { error: "The server returned no processor settings." };
    }
    return { status: d.settings as Status };
  } catch {
    return { error: "Network error while loading processor settings." };
  }
}

export default function PaymentSettingsPane() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [environment, setEnvironment] = useState<"test" | "live">("test");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [webhookHash, setWebhookHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  // Whether the real saved state has been loaded. Saving stays locked until it
  // is, so a transient load failure can never persist a guessed "disabled".
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const applyStatus = useCallback((s: Status) => {
    setStatus(s);
    setEnabled(s.enabled);
    if (s.environment) setEnvironment(s.environment);
    setLoaded(true);
    setLoadError(null);
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    const r = await fetchStatus();
    if ("status" in r) {
      applyStatus(r.status);
      return true;
    }
    if (r.unauthorized) {
      router.replace("/admin/login");
    }
    setLoaded(false);
    setLoadError(r.error);
    return false;
  }, [applyStatus, router]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load().finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const save = async () => {
    setError(null);
    setOk(null);
    setTestResult(null);
    if (!loaded) {
      setError("Reload the current settings first — the switch is locked until the real saved state loads (no changes were made).");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, string | boolean> = { enabled, environment };
      if (clientId.trim()) payload.clientId = clientId.trim();
      if (clientSecret.trim()) payload.clientSecret = clientSecret.trim();
      if (webhookHash.trim()) payload.webhookHash = webhookHash.trim();
      const res = await fetch("/api/admin/payment-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not save payment settings.");
      setClientId("");
      setClientSecret("");
      setWebhookHash("");
      setOk("Payment settings saved.");
      try {
        if (d.settings) {
          applyStatus(d.settings as Status);
          return;
        }
      } catch {
        /* fall through to a fresh read below */
      }
      const r = await fetchStatus();
      if ("status" in r) {
        applyStatus(r.status);
      } else {
        setLoadError(`${r.error} The save succeeded but could not be re-verified.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save payment settings.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setError(null);
    setOk(null);
    setTestResult(null);
    setTesting(true);
    try {
      const res = await fetch("/api/admin/payment-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim() || undefined,
          clientSecret: clientSecret.trim() || undefined,
          environment,
        }),
      });
      const d = await res.json();
      setTestResult({ ok: Boolean(d.ok), message: d.message || "Test finished." });
    } catch {
      setTestResult({ ok: false, message: "Connection failed. Try again." });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading payment settings…</p>;
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-200">Processor state is unknown</p>
            <p className="mt-0.5 text-xs leading-5 text-amber-200/80">
              {loadError} The switch and Save are locked until the real saved state loads, so nothing can be turned OFF by accident.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="shrink-0 rounded-full bg-amber-500/20 px-4 py-1.5 text-sm font-bold text-amber-100 ring-1 ring-amber-500/30 transition hover:bg-amber-500/30"
          >
            Reload
          </button>
        </div>
      )}

      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-white">ATM Card processor</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Customers pay on Flutterwave&apos;s hosted page — card details never reach this site.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-4 py-1.5 text-sm font-bold ring-1 ${
                loaded && status?.ready
                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                  : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
              }`}
            >
              {loaded ? (status?.ready ? "Ready" : "Not ready") : "Unknown"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              disabled={!loaded}
              onClick={() => setEnabled((v) => !v)}
              title={loaded ? undefined : "Locked until the real saved state loads."}
              className={`relative h-8 w-14 shrink-0 rounded-full transition ${
                enabled ? "bg-emerald-500" : "bg-zinc-600"
              } ${loaded ? "" : "cursor-not-allowed opacity-50"}`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${enabled ? "left-7" : "left-1"}`}
              />
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          {loaded ? (
            enabled ? (
              "Card payments are enabled for fans. No live card charges can happen while the environment is set to Test."
            ) : (
              "Card payments are disabled for fans. Flip the switch to enable them."
            )
          ) : (
            "The saved on/off state hasn't loaded yet — controls are temporarily locked."
          )}
        </p>
      </div>

      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-black text-white">Environment</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Test uses Flutterwave test keys and never moves real money. Live charges only work with live keys and are
          deliberately blocked unless this is set to Live.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setEnvironment("test")}
            className={`rounded-2xl border p-4 text-left transition ${
              environment === "test" ? "border-primary-500/60 bg-primary-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"
            }`}
          >
            <p className="text-base font-black text-white">Test</p>
            <p className="mt-0.5 text-sm text-zinc-400">Flutterwave sandbox — no real money.</p>
          </button>
          <button
            type="button"
            onClick={() => setEnvironment("live")}
            className={`rounded-2xl border p-4 text-left transition ${
              environment === "live" ? "border-emerald-500/60 bg-emerald-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"
            }`}
          >
            <p className="text-base font-black text-white">Live</p>
            <p className="mt-0.5 text-sm text-zinc-400">Real card charges. Only enable with live keys.</p>
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-black text-white">Flutterwave credentials</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          From your Flutterwave dashboard (<code className="text-zinc-300">Developers → Settings → API Keys</code>), the{" "}
          <strong className="text-zinc-200">v4 view</strong>: an <strong className="text-zinc-200">Client ID</strong> (UUID like
          <code className="text-primary-300"> 9543ec71-…</code>) and a <strong className="text-zinc-200">Client Secret</strong>. This is the new v4 API —
          the legacy v3 <strong className="text-zinc-200">Public Key / Secret Key</strong> (<code className="text-zinc-300">FLWPUBK-…</code> /{" "}
          <code className="text-zinc-300">FLWSECK-…</code>) are <em>not</em> accepted here. Secrets are server-side only — never sent back to the
          browser, never logged, and never included in error messages. Recommended: set{" "}
          <code className="text-zinc-300">FLUTTERWAVE_CLIENT_SECRET</code> in the server environment so no secret is stored in a database. Keys saved here end
          up in the database; set <code className="text-zinc-300">AI_KEY_ENCRYPTION_KEY</code> in the environment to encrypt them at rest.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-semibold text-zinc-300">Client ID</label>
              <div className="flex items-center gap-2">
                <SourceChip source={status?.clientIdSource} />
                <KeyStatus configured={status?.clientIdConfigured} />
              </div>
            </div>
            <input
              type="text"
              autoComplete="off"
              className={inputCls}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={
                status?.clientIdConfigured
                  ? `Current Client ID ends in ${status.clientIdLast4} — paste a new one to replace it`
                  : "Paste your Flutterwave v4 Client ID (UUID)…"
              }
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-semibold text-zinc-300">Client Secret</label>
              <div className="flex items-center gap-2">
                <SourceChip source={status?.clientSecretSource} />
                <KeyStatus configured={status?.clientSecretConfigured} />
              </div>
            </div>
            <input
              type="password"
              autoComplete="off"
              className={inputCls}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={
                status?.clientSecretConfigured ? `New Client Secret — current key ends in ${status.clientSecretLast4}` : "Paste your Flutterwave v4 Client Secret…"
              }
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-semibold text-zinc-300">Webhook secret hash</label>
              <div className="flex items-center gap-2">
                <SourceChip source={status?.webhookHashSource} />
                <KeyStatus configured={status?.webhookHashConfigured} />
              </div>
            </div>
            <input
              type="password"
              autoComplete="off"
              className={inputCls}
              value={webhookHash}
              onChange={(e) => setWebhookHash(e.target.value)}
              placeholder={
                status?.webhookHashConfigured
                  ? `Current hash ends in ${status.webhookHashLast4} — paste a new one to replace it`
                  : "Paste the Secret Hash from your Flutterwave webhook settings…"
              }
            />
            <p className="mt-1.5 text-xs leading-5 text-zinc-500">
              Set this in the Flutterwave dashboard (<code className="text-zinc-300">Developers → Settings → Webhooks</code>) — it&apos;s the value
              Flutterwave HMAC-SHA256-signs every payload with (your signature appears in the{" "}
              <code className="text-zinc-300">flutterwave-signature</code> header). Point the webhook at{" "}
              <code className="text-zinc-300">{status?.webhookUrl}</code>, and ensure the API base URL matches the environment
              above (<code className="text-zinc-300">{status?.apiBaseUrl}</code>). Every webhook is signature-verified and then
              re-checked against <code className="text-zinc-300">{"GET /charges/{id}"}</code> before anything is settled.
            </p>
          </div>
        </div>

        {error && <div className={errCls}>{error}</div>}
        {ok && <div className={okCls}>{ok}</div>}
        {testResult && (
          <div className={testResult.ok ? okCls : errCls}>
            {testResult.ok ? "✓ " : ""}
            {testResult.message}
          </div>
        )}
        {status && !status.encryptionEnabled && (
          <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-200/90">
            At-rest storage: <span className="font-semibold">not encrypted</span>. Set{" "}
            <code className="text-amber-100">AI_KEY_ENCRYPTION_KEY</code> (or use environment variables) to protect stored keys.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy || !loaded}
            title={loaded ? undefined : "Locked until the real saved state loads."}
            className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save settings"}
          </button>
          <button
            type="button"
            onClick={test}
            disabled={testing}
            className="rounded-full px-6 py-2.5 text-sm font-bold text-white ring-1 ring-white/10 transition hover:ring-primary-500/40 disabled:opacity-60"
          >
            {testing ? "Testing…" : "Test connection"}
          </button>
          <button type="button" onClick={() => void load()} className="rounded-full px-4 py-2 text-sm text-zinc-400 transition hover:text-white">
            Refresh status
          </button>
        </div>
      </div>
    </div>
  );
}

function KeyStatus({ configured }: { configured: boolean | undefined }) {
  return (
    <span className={`text-xs font-semibold ${configured ? "text-emerald-400" : "text-zinc-500"}`}>
      {configured ? "● configured" : "○ not set"}
    </span>
  );
}

function SourceChip({ source }: { source: "db" | "env" | "" | undefined }) {
  if (source === "env") {
    return <span className="rounded bg-primary-500/15 px-1.5 py-0.5 text-[10px] font-bold text-primary-300">env</span>;
  }
  if (source === "db") {
    return <span className="rounded bg-zinc-500/15 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">db</span>;
  }
  return null;
}