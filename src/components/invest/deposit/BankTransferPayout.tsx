"use client";

import { useEffect, useState } from "react";
import { formatUSD, postDepositIntent, type DepositIntent } from "./depositShared";

type CountryOption = { country: string; flag: string | null; currencies: string[] };

/**
 * SELECT COUNTRY → SELECT CURRENCY step of the Bank Transfer flow.
 *
 * The list of countries and their currencies comes straight from the
 * admin-managed active bank accounts (the single source of truth). Only
 * configured country/currency combinations can ever appear, and the exact
 * destination account is resolved by the backend on the intent — nothing here
 * invents or substitutes banking data.
 */
export default function BankTransferPayout({
  amount,
  onBack,
  onIntent,
}: {
  amount: number;
  onBack: () => void;
  onIntent: (intent: DepositIntent) => void;
}) {
  const [catalog, setCatalog] = useState<CountryOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/invest/deposits", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setLoadError(data.error || "Could not load the available countries. Please try again.");
          return;
        }
        setCatalog(Array.isArray(data?.bankTransfer) ? (data.bankTransfer as CountryOption[]) : []);
      } catch {
        if (active) setLoadError("Could not load the available countries. Please try again.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const countryOption = catalog?.find((c) => c.country === country) ?? null;

  async function continueToDetails() {
    if (!country || !currency || busy) return;
    setBusy(true);
    setError(null);
    try {
      const intent = await postDepositIntent(String(amount), "bank-transfer", { country, currency });
      onIntent(intent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start your bank transfer. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <BackHeader onBack={onBack} label="Bank Transfer" />
        <div className="rounded-3xl bg-rose-500/10 px-5 py-8 text-center ring-1 ring-rose-500/30">
          <p className="text-[14px] font-bold text-white">Could not load payment destinations</p>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">{loadError}</p>
        </div>
      </div>
    );
  }

  if (catalog && catalog.length === 0) {
    return (
      <div className="space-y-4">
        <BackHeader onBack={onBack} label="Bank Transfer" />
        <div className="rounded-3xl bg-rose-500/10 px-5 py-8 text-center ring-1 ring-rose-500/30">
          <p className="text-[14px] font-bold text-white">Bank account unavailable for this country/currency.</p>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">
            No bank transfer destinations are configured yet. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackHeader onBack={onBack} label="Bank Transfer" />

      <div className="rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 text-center ring-1 ring-white/[0.08]">
        <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Amount to pay</p>
        <p className="mt-1 text-[32px] font-black text-white">{formatUSD(amount)}</p>
        <p className="mt-1 text-[12px] text-zinc-500">Choose the country and currency you will pay with.</p>
      </div>

      {!country ? (
        <section>
          <StepLabel step={1} label="Select country" />
          {!catalog ? (
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-3xl bg-white/[0.04] ring-1 ring-white/[0.05]" />
              ))}
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {catalog.map((c) => (
                <button
                  key={c.country}
                  type="button"
                  onClick={() => {
                    setCountry(c.country);
                    setCurrency(null);
                  }}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition active:bg-white/[0.07]"
                >
                  <span className="text-2xl">{c.flag ?? "🌍"}</span>
                  <span className="mt-1.5 block truncate text-[14px] font-black text-white">{c.country}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-zinc-500">
                    {c.currencies.length} {c.currencies.length === 1 ? "currency" : "currencies"} available
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section>
          <StepLabel step={2} label="Select currency" />
          <div className="mt-2 rounded-3xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.07]">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{countryOption?.flag ?? "🌍"}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-black text-white">{country}</span>
                <span className="block text-[11px] font-semibold text-zinc-500">Choose the currency to pay with</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setCountry(null);
                  setCurrency(null);
                }}
                className="shrink-0 rounded-full bg-white/[0.05] px-3 py-1.5 text-[12px] font-bold text-sky-400 ring-1 ring-white/10 transition active:scale-95"
              >
                Change
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            {(countryOption?.currencies ?? []).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setCurrency(code)}
                className={`rounded-3xl border px-4 py-4 text-center transition active:scale-[0.98] ${
                  currency === code
                    ? "border-sky-400/60 bg-sky-500/15"
                    : "border-white/10 bg-white/[0.03] active:bg-white/[0.07]"
                }`}
              >
                <span className="block text-[18px] font-black tracking-wide text-white">{code}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-white/[0.02] px-4 py-3.5 ring-1 ring-white/[0.06]">
        <p className="text-[12px] leading-6 text-zinc-500">
          Payment destinations come from the admin dashboard — only the countries and currencies that are actually
          configured can be chosen. Your bank-transfer details are shown only after you select both.
        </p>
      </section>

      {error && (
        <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/30">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!country || !currency || busy}
        onClick={() => void continueToDetails()}
        className="btn-grad w-full rounded-2xl py-4 text-[16px] font-black tracking-wide text-white shadow-xl shadow-primary-600/25 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Setting up your deposit…" : "Continue"}
      </button>
    </div>
  );
}

function StepLabel({ step, label }: { step: number; label: string }) {
  return (
    <p className="flex items-center gap-2 px-1 text-[13px] font-black uppercase tracking-[0.18em] text-zinc-400">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-primary-500/15 text-[11px] font-black text-primary-300 ring-1 ring-primary-400/30">
        {step}
      </span>
      {label}
    </p>
  );
}

function BackHeader({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <button
        aria-label="Back"
        onClick={onBack}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.05] text-zinc-300 ring-1 ring-white/10 transition active:scale-90 hover:bg-white/[0.1]"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <p className="text-[17px] font-black tracking-wide text-white">{label}</p>
    </div>
  );
}