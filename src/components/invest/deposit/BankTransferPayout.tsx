"use client";

import { useEffect, useState } from "react";
import { currencyName, formatUSD, postDepositIntent, type DepositIntent } from "./depositShared";

type CountryOption = { country: string; flag: string | null; currencies: string[] };

function codesLabel(codes: string[]): string {
  return codes.slice(0, 3).join(" · ") + (codes.length > 3 ? ` +${codes.length - 3}` : "");
}

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

  const countryStepDone = country !== null;
  const currencyStepDone = currency !== null;

  return (
    <div className="space-y-4">
      <BackHeader onBack={onBack} label="Bank Transfer" />

      <Stepper
        steps={[
          { label: "Country", done: countryStepDone, current: !countryStepDone },
          { label: "Currency", done: currencyStepDone, current: countryStepDone && !currencyStepDone },
        ]}
      />

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#101427] via-[#0b0f1d] to-[#080a12] p-5 ring-1 ring-white/[0.08]">
        <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-primary-600/20 blur-[70px]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">Amount to pay</p>
        <p className="mt-2 text-[38px] font-black leading-none tracking-tight text-white">{formatUSD(amount)}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">
          Choose the country and currency you want to pay with — your bank-transfer details are shown next.
        </p>
      </div>

      {!countryStepDone ? (
        <section>
          <p className="px-1 text-[15px] font-black tracking-wide text-white">Select country</p>
          {!catalog ? (
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[74px] animate-pulse rounded-3xl bg-white/[0.04] ring-1 ring-white/[0.05]" />
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
                  className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition active:scale-[0.98] active:bg-white/[0.07]"
                >
                  <span className="text-[26px] leading-none">{c.flag ?? "🌍"}</span>
                  <span className="mt-2 block truncate text-[14px] font-black text-white">{c.country}</span>
                  <span className="mt-1 block text-[11px] font-bold tabular-nums tracking-wide text-zinc-500">
                    {codesLabel(c.currencies)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section>
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-[15px] font-black tracking-wide text-white">Select currency</p>
            <button
              type="button"
              onClick={() => {
                setCountry(null);
                setCurrency(null);
              }}
              className="rounded-full bg-white/[0.05] px-3 py-1.5 text-[12px] font-bold text-sky-400 ring-1 ring-white/10 transition active:scale-95"
            >
              Change country
            </button>
          </div>

          <div className="mt-2 flex items-center gap-3 rounded-3xl bg-white/[0.03] px-4 py-3.5 ring-1 ring-white/[0.07]">
            <span className="text-[26px] leading-none">{countryOption?.flag ?? "🌍"}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-black text-white">{country}</span>
              <span className="block text-[11px] font-semibold text-zinc-500">
                {countryOption?.currencies.length ?? 0}{" "}
                {countryOption?.currencies.length === 1 ? "currency" : "currencies"} available
              </span>
            </span>
          </div>

          <div className="mt-2 space-y-2.5">
            {(countryOption?.currencies ?? []).map((code) => {
              const active = currency === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrency(code)}
                  className={`flex w-full items-center gap-3 rounded-3xl border px-4 py-3.5 text-left transition active:scale-[0.99] ${
                    active
                      ? "border-sky-400/60 bg-sky-500/15"
                      : "border-white/10 bg-white/[0.03] active:bg-white/[0.07]"
                  }`}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.05] text-[13px] font-black text-white ring-1 ring-white/10">
                    {code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-black text-white">{currencyName(code)}</span>
                    <span className="block text-[11px] font-semibold text-zinc-500">{code}</span>
                  </span>
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-black transition ${
                      active ? "bg-sky-500 text-white" : "border-2 border-white/20 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                </button>
              );
            })}
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
        {busy ? "Setting up your deposit…" : "Continue to bank details"}
      </button>
    </div>
  );
}

function Stepper({ steps }: { steps: { label: string; done: boolean; current: boolean }[] }) {
  return (
    <div className="flex items-center gap-2 px-1">
      {steps.map((s, i) => (
        <div key={s.label} className="flex flex-1 items-center gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black transition ${
                s.done
                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
                  : s.current
                    ? "bg-primary-500/20 text-primary-200 ring-1 ring-primary-400/40"
                    : "bg-white/[0.04] text-zinc-600 ring-1 ring-white/10"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <span
              className={`text-[11px] font-black uppercase tracking-[0.15em] ${
                s.done ? "text-emerald-300" : s.current ? "text-white" : "text-zinc-600"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && <span className={`h-px flex-1 ${s.done ? "bg-emerald-400/40" : "bg-white/10"}`} />}
        </div>
      ))}
    </div>
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