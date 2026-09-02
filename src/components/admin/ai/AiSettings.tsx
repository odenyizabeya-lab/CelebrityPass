"use client";

import { useEffect, useState } from "react";

export default function AiSettings() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ai-settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setHasKey(Boolean(d.hasKey)))
      .catch(() => setHasKey(false));
  }, []);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the key.");
      setHasKey(data.hasKey);
      setValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the key.");
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
        <h2 className="text-lg font-black text-white">AI Scanner key</h2>
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        {hasKey
          ? "A Gemini API key is saved. When you upload a celebrity photo and press Scan, it will auto-fill the whole form."
          : "No key is saved yet — the Scan button will tell you to set one first. Get a free key at aistudio.google.com/apikey and paste it below."}
      </p>

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Gemini API key</label>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste your API key here"
          className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500"
        />
        <p className="mt-1 text-xs text-zinc-500">
          The key is stored securely server-side and is never shown back to you or the browser.
        </p>
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

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
            onClick={async () => {
              setError(null);
              setBusy(true);
              try {
                const res = await fetch("/api/admin/ai-settings", {
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
            }}
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