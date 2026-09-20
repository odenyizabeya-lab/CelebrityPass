"use client";

import { useCallback, useEffect, useState } from "react";

const DEFAULT_ATM_INSTRUCTIONS =
  "1. Use any ATM machine to deposit cash (or a cheque) into the bank account shown below. " +
  "2. Choose 'Cash deposit (no card)' and enter the account number exactly. " +
  "3. Keep the ATM receipt — it shows your ATM transaction/reference number. " +
  "4. Enter that reference below and upload a photo of the ATM slip. " +
  "Your deposit is credited only after our team verifies the ATM transaction.";

const MAX_LEN = 6_000;

/**
 * Admin editor for the ATM deposit instructions shown to investors in the ATM
 * Deposit flow. This is separate from the Flutterwave "ATM Card processor"
 * status — that card processor setting is unrelated to ATM cash deposits.
 */
export default function AtmDepositInstructions() {
  const [value, setValue] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/invest/atm-config", { cache: "no-store" });
      if (res.status === 401) {
        window.location.assign("/admin/login");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setValue(data.instructions);
      setIsDefault(Boolean(data.isDefault));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load ATM instructions.");
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/invest/atm-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: value ?? "" }),
      });
      if (res.status === 401) {
        window.location.assign("/admin/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save ATM instructions.");
      setValue(data.instructions);
      setIsDefault(data.instructions === DEFAULT_ATM_INSTRUCTIONS);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save ATM instructions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-white">ATM cash-deposit instructions</h3>
          <p className="mt-0.5 max-w-2xl text-xs leading-5 text-zinc-400">
            Plain-text steps shown to investors inside the ATM Deposit flow, above the destination account. For example
            which ATM network to use, deposit timing, branch guidance, or currency notes. Separate from the Flutterwave{" "}
            “ATM Card processor” status above — that setting is about card payments, not cash deposits.
          </p>
        </div>
        {isDefault && (
          <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 ring-1 ring-white/10">
            Using defaults
          </span>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {value === null && !error && <p className="mt-3 text-sm text-zinc-400">Loading instructions…</p>}

      {value !== null && (
        <div className="mt-4 space-y-2">
          <textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            maxLength={MAX_LEN}
            rows={5}
            className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 font-mono text-sm leading-6 text-white outline-none focus:border-emerald-500"
            placeholder="One instruction per line. Saved text is what investors see."
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500">
              {value.length} / {MAX_LEN} chars · investors see this verbatim before they deposit.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setValue(DEFAULT_ATM_INSTRUCTIONS);
                  setSaved(false);
                }}
                className="rounded-full px-4 py-2 text-xs font-bold text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/5"
              >
                Use defaults
              </button>
              <button
                onClick={() => void save()}
                disabled={busy}
                className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-bold text-emerald-900 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy ? "Saving…" : saved ? "Saved ✓" : "Save instructions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}