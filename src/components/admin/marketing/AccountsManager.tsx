"use client";

import { useCallback, useEffect, useState } from "react";
import { api, EmptyState, fmtDate, PlatformMark, StatusBadge } from "./SocialUI";

interface Account {
  id: string;
  platformKey: string;
  platformName: string;
  platformColor: string;
  username: string | null;
  url: string | null;
  accountType: string | null;
  scopes: string[];
  status: string;
  isConnected: boolean;
  lastError: string | null;
  lastCheckedAt: Date | null;
  tokenExpiresAt: Date | null;
  tokenMask: string;
  hasRefreshToken: boolean;
}

interface Platform {
  key: string;
  name: string;
  color: string;
  oauth: boolean;
  enabled: boolean;
  requiresApproval: boolean;
  approvalStatus: string;
  approvalNote: string | null;
  hasCredentials: boolean;
  configuredEnv: boolean;
  apiStatus: string;
  apiNote: string | null;
  credentialEnvKeys: string[];
  howToConnect: string;
  accounts: Account[];
}

export default function AccountsManager() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokenInputs, setTokenInputs] = useState<Record<string, string>>({});
  const [channelInputs, setChannelInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ platforms: Platform[] }>("/api/social/admin/accounts");
      setPlatforms(d.platforms);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load platforms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const connectOAuth = async (p: Platform) => {
    setBusy(p.key);
    setError(null);
    setNote(null);
    try {
      const r = await api<{ authorizeUrl: string }>("/api/social/admin/accounts", {
        method: "POST",
        body: JSON.stringify({ action: "connect-oauth", platformKey: p.key }),
      });
      window.location.assign(r.authorizeUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start OAuth");
    } finally {
      setBusy(null);
    }
  };

  const connectToken = async (p: Platform) => {
    const token = (tokenInputs[p.key] ?? "").trim();
    setBusy(p.key);
    setError(null);
    setNote(null);
    try {
      await api("/api/social/admin/accounts", {
        method: "POST",
        body: JSON.stringify({ action: "connect-token", platformKey: p.key, token, channel: channelInputs[p.key] }),
      });
      setTokenInputs((s) => ({ ...s, [p.key]: "" }));
      setChannelInputs((s) => ({ ...s, [p.key]: "" }));
      setNote({ ok: true, text: `${p.name} connected and verified.` });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect");
    } finally {
      setBusy(null);
    }
  };

  const refresh = async (accountId: string) => {
    setBusy(accountId);
    setError(null);
    await api("/api/social/admin/accounts", { method: "POST", body: JSON.stringify({ action: "refresh", accountId }) }).catch((e) => setError(e instanceof Error ? e.message : "Refresh failed"));
    setBusy(null);
    await load();
  };

  const disconnect = async (p: Platform, accountId: string) => {
    if (!confirm("Disconnect this account? The token will be permanently deleted.")) return;
    setBusy(accountId);
    setError(null);
    await fetch(`/api/social/admin/accounts/${accountId}`, { method: "DELETE" }).catch(() => undefined);
    setBusy(null);
    await load();
  };

  const inputCls = "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Connected Accounts</h1>
          <p className="mt-1 text-sm text-zinc-400">Link each marketplace to a real social account. Tokens are encrypted and never stored in plain text.</p>
        </div>
        {note && <div className={`rounded-full px-4 py-2 text-sm ${note.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{note.text}</div>}
      </div>

      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">{error}</div>}

      {loading ? (
        <p className="py-16 text-center text-zinc-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          {platforms.map((p) => (
            <section key={p.key} className="glass rounded-3xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <PlatformMark name={p.name} color={p.color} />
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-black text-white">{p.name}</h2>
                      <StatusBadge status={p.accounts.length ? "connected" : p.configuredEnv ? "needs_refresh" : "disconnected"} />
                      {p.requiresApproval && (
                        <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-300">Approval needed</span>
                      )}
                    </div>
                    <p className="mt-1 max-w-xl text-sm text-zinc-400">{p.howToConnect}</p>
                    {!p.configuredEnv && (
                      <p className="mt-2 text-xs text-amber-300">Env keys missing: {p.credentialEnvKeys.join(", ")}</p>
                    )}
                  </div>
                </div>
                {p.oauth ? (
                  <button
                    onClick={() => connectOAuth(p)}
                    disabled={busy === p.key || !p.configuredEnv}
                    className="btn-grad rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy === p.key ? "Starting…" : p.accounts.length ? "Add another account" : "Connect with OAuth"}
                  </button>
                ) : (
                  <div className="w-full max-w-md space-y-2 lg:w-80">
                    <input
                      type="password"
                      value={tokenInputs[p.key] ?? ""}
                      onChange={(e) => setTokenInputs((s) => ({ ...s, [p.key]: e.target.value }))}
                      className={inputCls}
                      placeholder={p.key === "telegram" ? "Bot token from @BotFather (123:abc…)" : "WhatsApp Graph API access token"}
                      autoComplete="off"
                    />
                    {p.key === "telegram" && (
                      <input
                        value={channelInputs[p.key] ?? ""}
                        onChange={(e) => setChannelInputs((s) => ({ ...s, [p.key]: e.target.value }))}
                        className={inputCls}
                        placeholder="Channel @handle or chat id (optional)"
                      />
                    )}
                    <button
                      onClick={() => connectToken(p)}
                      disabled={busy === p.key || !(tokenInputs[p.key] ?? "").trim()}
                      className="btn-grad w-full rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {busy === p.key ? "Verifying…" : "Connect and verify"}
                    </button>
                    <p className="text-[11px] text-zinc-500">The platform API is called live to validate the token before saving.</p>
                  </div>
                )}
              </div>

              {p.accounts.length ? (
                <ul className="mt-5 space-y-2 border-t border-white/[0.06] pt-4">
                  {p.accounts.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink-950/50 px-4 py-3 ring-1 ring-white/[0.06]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{a.username ?? "Account"}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {a.accountType ?? "None"} · token {a.tokenMask} {a.hasRefreshToken ? "· refreshable" : ""} · checked {a.lastCheckedAt ? fmtDate(a.lastCheckedAt) : "—"}
                        </p>
                        {a.tokenExpiresAt && (
                          <p className="mt-0.5 text-xs text-zinc-500">Expires {fmtDate(a.tokenExpiresAt)}</p>
                        )}
                        {a.lastError && <p className="mt-0.5 text-xs text-rose-400">{a.lastError}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => refresh(a.id)} disabled={busy === a.id} className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-bold text-zinc-300 hover:bg-white/5 disabled:opacity-50">
                          Refresh token
                        </button>
                        <button onClick={() => disconnect(p, a.id)} disabled={busy === a.id} className="rounded-full border border-rose-500/30 px-4 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">
                          Disconnect
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState text="No connected account yet." />
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}