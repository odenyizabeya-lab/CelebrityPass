"use client";

import { useEffect, useState } from "react";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500";
const errCls = "mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300";
const okCls = "mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300";

type Status = {
  provider: string;
  model: string;
  modelOptions: string[];
  primaryConfigured: boolean;
  backupConfigured: boolean;
  primaryLast4: string;
  backupLast4: string;
  primarySource: "db" | "env" | "";
  backupSource: "db" | "env" | "";
  encryptionEnabled: boolean;
};

async function getStatus(): Promise<Status | null> {
  try {
    const res = await fetch("/api/admin/ai/settings", { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return d.settings ?? null;
  } catch {
    return null;
  }
}

export default function AiSettingsPane() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState("");
  const [primaryKey, setPrimaryKey] = useState("");
  const [backupKey, setBackupKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const s = await getStatus();
      if (!active) return;
      setStatus(s);
      if (s) setModel(s.model);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const refresh = async () => {
    const s = await getStatus();
    setStatus(s);
    if (s) setModel(s.model);
  };

  const save = async () => {
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const payload: Record<string, string> = { model };
      if (primaryKey.trim()) payload.primaryKey = primaryKey.trim();
      if (backupKey.trim()) payload.backupKey = backupKey.trim();
      const res = await fetch("/api/admin/ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not save AI settings.");
      setPrimaryKey("");
      setBackupKey("");
      setStatus(d.settings ?? null);
      setOk("AI settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save AI settings.");
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
      const res = await fetch("/api/admin/ai/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: primaryKey.trim() || undefined, model }),
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
    return <p className="text-sm text-zinc-400">Loading AI settings…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">AI Provider</h2>
            <p className="mt-1 text-sm text-zinc-400">The celebrity scanner uses only this provider.</p>
          </div>
          <span className="rounded-full bg-primary-500/15 px-4 py-1.5 text-sm font-bold text-primary-300 ring-1 ring-primary-500/30">
            {status?.provider ?? "Gemini"}
          </span>
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Model</label>
          <select value={model} onChange={(e) => setModel(e.target.value)} className={inputCls}>
            {(status?.modelOptions ?? ["gemini-3.6-flash"]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-zinc-500">
            The model that identifies the celebrity and researches their public profile, fan card and membership tiers.
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-black text-white">API keys</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Keys are server-side only — never sent back to the browser (you only see a masked hint), never logged, and never
          included in error messages. Recommended: set <code className="text-zinc-300">GEMINI_API_KEY</code> in the server
          environment so no key is ever stored in a database. Keys saved here end up in the database; set{" "}
          <code className="text-zinc-300">AI_KEY_ENCRYPTION_KEY</code> in the environment to encrypt them at rest.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-semibold text-zinc-300">Primary key (used first)</label>
              <div className="flex items-center gap-2">
                <SourceChip source={status?.primarySource} />
                <KeyStatus configured={status?.primaryConfigured} />
              </div>
            </div>
            <input
              type="password"
              autoComplete="off"
              className={inputCls}
              value={primaryKey}
              onChange={(e) => setPrimaryKey(e.target.value)}
              placeholder={
                status?.primaryConfigured ? `New Google AI key — current key ends in ${status.primaryLast4}` : "Paste a Google AI Studio API key…"
              }
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-semibold text-zinc-300">Backup key (automatic fallback)</label>
              <div className="flex items-center gap-2">
                <SourceChip source={status?.backupSource} />
                <KeyStatus configured={status?.backupConfigured} />
              </div>
            </div>
            <input
              type="password"
              autoComplete="off"
              className={inputCls}
              value={backupKey}
              onChange={(e) => setBackupKey(e.target.value)}
              placeholder={
                status?.backupConfigured ? `Fallback Google AI key — current key ends in ${status.backupLast4}` : "Optional: a second key to fall back to…"
              }
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Used for</label>
            <p className="text-xs leading-5 text-zinc-500">
              Primary key → backup key → <code className="text-zinc-300">GEMINI_API_KEY</code> →{" "}
              <code className="text-zinc-300">GEMINI_BACKUP_API_KEY</code> environment variables. Never displayed in
              frontend code or browser traffic.
            </p>
            <p className="mt-1.5 text-xs leading-5 text-zinc-500">
              At-rest storage:{" "}
              {status?.encryptionEnabled ? (
                <span className="text-emerald-400">encrypted — AI_KEY_ENCRYPTION_KEY is set</span>
              ) : (
                <span className="text-amber-400">not encrypted — set AI_KEY_ENCRYPTION_KEY (or use env vars) to protect stored keys</span>
              )}
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

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={busy} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
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
          <button type="button" onClick={refresh} className="rounded-full px-4 py-2 text-sm text-zinc-400 transition hover:text-white">
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