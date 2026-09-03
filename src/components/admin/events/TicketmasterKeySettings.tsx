"use client";

import { useEffect, useState } from "react";

/**
 * Admin control to paste the free Ticketmaster Discovery API key.
 * The key is stored server-side (AppSetting) and never shown back to the
 * browser — this UI only reflects a boolean "is set" state.
 */
export default function TicketmasterKeySettings() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ticketing-settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setHasKey(Boolean(d.hasKey)))
      .catch(() => setHasKey(false));
  }, []);

  async function save() {
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ticketing-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the key.");
      setHasKey(data.hasKey);
      setOk("Saved. You can now add/enable the Ticketmaster source and run a sync.");
      setValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the key.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ticketing-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not clear the key.");
      setHasKey(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear the key.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass max-w-2xl rounded-2xl p-6">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-3 w-3 rounded-full ${hasKey ? "bg-emerald-400" : hasKey === null ? "bg-zinc-600" : "bg-amber-400"}`}
        />
        <h2 className="text-lg font-black text-white">Ticketmaster API key</h2>
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        {hasKey
          ? "A Ticketmaster Discovery API key is saved. Real concerts, sports and theatre shows are pulled onto the celebrity profiles via a sync."
          : "No key is saved yet. Get a FREE key at developer.ticketmaster.com, paste it below, then add the Ticketmaster source and run a sync in 'Configured sources'."}
      </p>

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Ticketmaster API key</label>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste your free API key here"
          className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500"
        />
        <p className="mt-1 text-xs text-zinc-500">
          The key is stored securely server-side and is never shown back to you or the browser.
        </p>
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
      {ok && <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{ok}</div>}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : hasKey ? "Replace key" : "Save key"}
        </button>
        {hasKey && (
          <button
            onClick={clear}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-400 ring-1 ring-white/10 transition hover:text-rose-300 hover:ring-rose-500/30 disabled:opacity-50"
          >
            Clear saved key
          </button>
        )}
      </div>
    </div>
  );
}