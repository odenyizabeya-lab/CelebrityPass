"use client";

import { useCallback, useEffect, useState } from "react";
import { PlatformMark, StatusBadge, api } from "./SocialUI";

interface StatusRow {
  key: string;
  name: string;
  envConfigured: boolean;
  requiresApproval: boolean;
  approvalStatus: string;
  accounts: Array<{ id: string; username: string | null; status: string; verify: "ok" | "error" | "skipped"; message?: string }>;
}

export default function ApiStatus() {
  const [rows, setRows] = useState<StatusRow[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setChecking(true);
    try {
      const d = await api<{ statuses: StatusRow[] }>("/api/social/admin/api-status");
      setRows(d.statuses);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status check failed");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load(true);
    })();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">API Status</h1>
          <p className="mt-1 text-sm text-zinc-400">Live verification of every platform credential and connected account against the official APIs.</p>
        </div>
        <button onClick={() => load()} disabled={checking} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {checking ? "Checking…" : "Re-check now"}
        </button>
      </div>

      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">{error}</div>}

      {!rows ? (
        <p className="py-16 text-center text-zinc-500">Checking…</p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const okCount = r.accounts.filter((a) => a.verify === "ok").length;
            const overall = !r.envConfigured ? "disconnected" : r.accounts.length === 0 ? "needs_refresh" : okCount === r.accounts.length ? "connected" : "invalid";
            return (
              <section key={r.key} className="glass rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <PlatformMark name={r.name} color="#8b5cf6" />
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-lg font-black text-white">{r.name}</h2>
                        <StatusBadge status={overall} />
                        {r.requiresApproval && <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-300">development approval: {r.approvalStatus}</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {r.envConfigured ? "env credentials configured" : "env credentials missing"} · {okCount}/{r.accounts.length} accounts verified
                      </p>
                    </div>
                  </div>
                </div>
                {r.accounts.length ? (
                  <ul className="mt-4 space-y-2">
                    {r.accounts.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink-950/50 px-4 py-2.5 ring-1 ring-white/[0.06]">
                        <span className="text-sm text-zinc-300">{a.username ?? "Account"}</span>
                        <span className="flex items-center gap-2 text-xs">
                          <StatusBadge status={a.verify === "ok" ? "connected" : "invalid"} />
                          {a.message && <span className="max-w-md truncate text-rose-400">{a.message}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-zinc-500">No connected account. Connect one on the Accounts page.</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}