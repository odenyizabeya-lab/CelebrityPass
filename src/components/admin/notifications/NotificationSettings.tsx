"use client";

import { useEffect, useState } from "react";

export default function NotificationSettings() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [source, setSource] = useState<string>("");
  const [emailFrom, setEmailFrom] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/notification-settings")
      .then((r) => r.json())
      .then((d) => {
        setHasKey(Boolean(d.hasKey));
        setSource(d.source ?? "");
        setEmailFrom(d.emailFrom ?? "");
      })
      .catch(() => setHasKey(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notification-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), emailFrom: emailFrom.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save settings.");
        setLoading(false);
        return;
      }
      setApiKey("");
      setSaved(true);
      setHasKey(true);
      setLoading(false);
    } catch {
      setError("Network error. Could not save settings.");
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="glass rounded-3xl p-7">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Email Notifications</p>
        <h2 className="mt-1 text-xl font-black tracking-tight">Transactional email</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Send order confirmations, refund notices and fan-card emails to customers.
        </p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 text-xs">
          <span className={`h-2 w-2 rounded-full ${hasKey ? "bg-emerald-400" : "bg-rose-400"}`} />
          <span className="text-zinc-300">
            {hasKey === null
              ? "Checking…"
              : hasKey
              ? `Email configured${source ? ` (${source})` : ""}`
              : "Email not configured yet"}
          </span>
        </div>

        <form onSubmit={save} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Resend API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className={inputCls}
              placeholder={hasKey ? "•••••••••••• (saved — leave blank to keep)" : "re_…"}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Create one free at <span className="font-mono text-zinc-400">resend.com</span>. Stored encrypted, never
              shown again.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">From address</label>
            <input
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              className={inputCls}
              placeholder="Fan Card <noreply@yourdomain.com>"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Must be a verified sender in your Resend account.
            </p>
          </div>

          {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
          {saved && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">Settings saved.</div>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {loading ? "Saving…" : "Save settings"}
            </button>
            {hasKey && (
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  await fetch("/api/admin/notification-settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ apiKey: "" }),
                  });
                  setHasKey(false);
                  setSource("");
                }}
                className="rounded-full border border-rose-500/30 px-5 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10"
              >
                Clear key
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="glass rounded-3xl p-7">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">What gets sent</p>
        <ul className="mt-3 space-y-2 text-sm text-zinc-400">
          <li>• Fan card issued — to the fan when their card is created</li>
          <li>• Order confirmed — after a paid ticket order</li>
          <li>• Transfer received — after a bank-transfer proof is submitted</li>
          <li>• Refund processed — after a refund is recorded</li>
        </ul>
        <p className="mt-4 text-xs text-zinc-500">
          Emails are sent in the background and never block a purchase. If no provider is configured, purchases still
          complete normally.
        </p>
      </div>
    </div>
  );
}
