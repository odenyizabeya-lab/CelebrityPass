"use client";

import { useEffect, useState } from "react";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500";
const errCls = "mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300";
const okCls = "mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300";

type Usage = {
  keyLast4: string | null;
  today: { day: string; requests: number; promptTokens: number; outputTokens: number; thoughtsTokens: number };
  history: { day: string; requests: number; totalTokens: number }[];
  quotaHits: number;
  lastQuotaAt: string | null;
  lastQuotaMessage: string | null;
};

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
  assistant?: {
    keyConfigured: boolean;
    keyLast4: string;
    keySource: "db" | "env" | "";
    model: string;
    modelSource: "db" | "env" | "";
    baseUrl: string;
    baseUrlSource: "db" | "env" | "";
    encryptionEnabled: boolean;
    defaultModel: string;
    usage?: Usage | null;
  };
};

async function getStatus(): Promise<Status | null> {
  try {
    const res = await fetch("/api/admin/ai/settings", { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return { ...(d.settings ?? null), assistant: d.assistant ?? null };
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
  const [assistantKey, setAssistantKey] = useState("");
  const [assistantModel, setAssistantModel] = useState("");
  const [assistantBaseUrl, setAssistantBaseUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [assistantTesting, setAssistantTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [assistantTestResult, setAssistantTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const s = await getStatus();
      if (!active) return;
      setStatus(s);
      if (s) {
        setModel(s.model);
        setAssistantModel(s.assistant?.model ?? "");
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const refresh = async () => {
    const s = await getStatus();
    setStatus(s);
    if (s) {
      setModel(s.model);
      setAssistantModel(s.assistant?.model ?? "");
    }
  };

  const save = async () => {
    setError(null);
    setOk(null);
    setTesting(false);
    setAssistantTesting(false);
    setTestResult(null);
    setAssistantTestResult(null);
    setBusy(true);
    try {
      const payload: Record<string, string> = { model };
      if (primaryKey.trim()) payload.primaryKey = primaryKey.trim();
      if (backupKey.trim()) payload.backupKey = backupKey.trim();
      payload.assistantKey = assistantKey.trim();
      payload.assistantModel = assistantModel.trim() || status?.assistant?.defaultModel || "";
      payload.assistantBaseUrl = assistantBaseUrl.trim();
      const res = await fetch("/api/admin/ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not save AI settings.");
      setPrimaryKey("");
      setBackupKey("");
      setAssistantKey("");
      const merged = { ...(d.settings ?? null), assistant: d.assistant ?? null };
      setStatus(merged);
      setAssistantModel(d.assistant?.model ?? "");
      setOk("AI settings saved. The assistant picks up new keys instantly — no redeploy needed.");
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
    setAssistantTestResult(null);
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

  const testAssistant = async () => {
    setError(null);
    setOk(null);
    setAssistantTestResult(null);
    setTestResult(null);
    setAssistantTesting(true);
    try {
      const res = await fetch("/api/admin/ai/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: assistantKey.trim() || undefined,
          model: assistantModel.trim() || status?.assistant?.defaultModel,
        }),
      });
      const d = await res.json();
      setAssistantTestResult({ ok: Boolean(d.ok), message: d.message || "Test finished." });
    } catch {
      setAssistantTestResult({ ok: false, message: "Connection failed. Try again." });
    } finally {
      setAssistantTesting(false);
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

      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">AI Reply Assistant (fans&apos; chat)</h2>
            <p className="mt-1 text-sm text-zinc-400">
              The 24/7 auto-chat that replies to fans in each celebrity&apos;s voice. Completely separate from the scanner above — its own key, its own model.
            </p>
          </div>
          <span
            className={`rounded-full px-4 py-1.5 text-sm font-bold ring-1 ${
              status?.assistant?.keyConfigured ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
            }`}
          >
            {status?.assistant?.keyConfigured ? "● live AI" : "○ templates only"}
          </span>
        </div>

        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Paste any Gemini key (free keys work). Saving here applies it <strong className="text-zinc-300">instantly</strong> to the already-running
          site — no code, no redeploy, no restart. Swap keys any time; old keys just stop being used. Use the{" "}
          <code className="text-zinc-300">Test</code> button when you paste a new key to confirm it works before you rely on it.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-semibold text-zinc-300">Assistant Gemini key</label>
              <div className="flex items-center gap-2">
                <SourceChip source={status?.assistant?.keySource} />
                <KeyStatus configured={status?.assistant?.keyConfigured} />
              </div>
            </div>
            <input
              type="password"
              autoComplete="off"
              className={inputCls}
              value={assistantKey}
              onChange={(e) => setAssistantKey(e.target.value)}
              placeholder={
                status?.assistant?.keyConfigured ? `Current key ends in ${status.assistant.keyLast4} — paste a new one to swap` : "Paste a free Google AI Studio API key…"
              }
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Stored securely in the database (encrypted at rest when{" "}
              <code className="text-zinc-300">AI_KEY_ENCRYPTION_KEY</code> is set); never shown back to you except a masked hint. Fallback:{" "}
              <code className="text-zinc-300">ASSIST_GEMINI_KEY</code> in the server environment.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Model</label>
            <input
              type="text"
              autoComplete="off"
              className={inputCls}
              value={assistantModel}
              onChange={(e) => setAssistantModel(e.target.value)}
              placeholder={status?.assistant?.defaultModel ?? "gemini-2.5-flash"}
            />
            <p className="mt-1.5 text-xs text-zinc-500">Leave empty to use {status?.assistant?.defaultModel ?? "gemini-2.5-flash"}.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">API base URL</label>
            <input
              type="text"
              autoComplete="off"
              className={inputCls}
              value={assistantBaseUrl}
              onChange={(e) => setAssistantBaseUrl(e.target.value)}
              placeholder="https://generativelanguage.googleapis.com/v1beta"
            />
            <p className="mt-1.5 text-xs text-zinc-500">Optional — only change this if you&apos;re using a Gemini-compatible proxy.</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-ink-900/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-white">Fan-chat AI usage</h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                Real consumption of the key powering fan replies — requests and tokens today, and an instant warning the
                moment the key hits Gemini&apos;s limit so you can swap it before fans notice.
              </p>
            </div>
            <UsagePill usage={status?.assistant?.usage} />
          </div>

          {status?.assistant?.usage ? (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-3">
                <Stat label="Requests today" value={status.assistant.usage.today.requests.toLocaleString()} />
                <Stat label="Input tokens" value={status.assistant.usage.today.promptTokens.toLocaleString()} />
                <Stat label="Output tokens" value={status.assistant.usage.today.outputTokens.toLocaleString()} />
              </div>

              {status.assistant.usage.today.requests > 0 && (
                <p className="mt-2 text-xs text-zinc-500">
                  ≈ {Math.max(1, Math.round(status.assistant.usage.today.outputTokens / status.assistant.usage.today.requests)).toLocaleString()} output
                  tokens per reply · key {status.assistant.usage.keyLast4 ?? "—"}
                </p>
              )}

              {status.assistant.usage.quotaHits > 0 && (
                <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3">
                  <p className="text-sm font-bold text-rose-300">
                    ⚠ This key already hit Gemini&apos;s limit {status.assistant.usage.quotaHits}× — paste a fresh key above and Save now.
                  </p>
                  {status.assistant.usage.lastQuotaAt && (
                    <p className="mt-1 text-xs text-rose-300/70">
                      Last hit: {new Date(status.assistant.usage.lastQuotaAt).toLocaleString()}
                    </p>
                  )}
                  {status.assistant.usage.lastQuotaMessage && (
                    <p className="mt-0.5 truncate text-xs text-rose-300/50" title={status.assistant.usage.lastQuotaMessage}>
                      {status.assistant.usage.lastQuotaMessage}
                    </p>
                  )}
                </div>
              )}

              {status.assistant.usage.history.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-semibold text-zinc-400">Last {status.assistant.usage.history.length} days</p>
                  <div className="space-y-1">
                    {status.assistant.usage.history.map((h) => (
                      <div key={h.day} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400">
                        <span className="font-mono">{h.day}</span>
                        <span>
                          {h.requests.toLocaleString()} req · {h.totalTokens.toLocaleString()} tokens
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              No usage recorded yet. Usage starts counting on the next real AI reply when a key is working.
            </p>
          )}

          <p className="mt-4 text-xs leading-5 text-zinc-500">
            Counters reset every day (UTC), and start fresh automatically when you swap to a different key — so the meter
            always shows the key that is actually chatting with fans. Google doesn&apos;t publish an exact “% remaining”, so
            watch the daily burn here and swap the key the moment it looks heavy or the warning above turns red.
          </p>
        </div>

        {assistantTestResult && (
          <div className={assistantTestResult.ok ? okCls : errCls}>
            {assistantTestResult.ok ? "✓ " : ""}
            {assistantTestResult.message}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={busy} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {busy ? "Saving…" : "Save assistant key"}
          </button>
          <button
            type="button"
            onClick={testAssistant}
            disabled={assistantTesting}
            className="rounded-full px-6 py-2.5 text-sm font-bold text-white ring-1 ring-white/10 transition hover:ring-primary-500/40 disabled:opacity-60"
          >
            {assistantTesting ? "Testing…" : "Test key"}
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

function UsagePill({ usage }: { usage: Usage | null | undefined }) {
  const quotaHit = (usage?.quotaHits ?? 0) > 0;
  if (quotaHit) {
    return (
      <span className="rounded-full bg-rose-500/15 px-4 py-1.5 text-sm font-bold text-rose-300 ring-1 ring-rose-500/40">
        ● LIMIT HIT — swap key now
      </span>
    );
  }
  if (usage && usage.today.requests > 0) {
    return (
      <span className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-sm font-bold text-emerald-300 ring-1 ring-emerald-500/30">
        ● key working · {usage.today.requests.toLocaleString()} req today
      </span>
    );
  }
  return (
    <span className="rounded-full bg-zinc-500/15 px-4 py-1.5 text-sm font-bold text-zinc-400 ring-1 ring-zinc-500/30">
      ○ no usage yet
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-black text-white">{value}</p>
    </div>
  );
}