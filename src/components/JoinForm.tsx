"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { MembershipLevelType } from "@/lib/utils";
import { formatMoney } from "@/lib/payments";
import { fetchWithTimeout } from "@/lib/client-http";
import { useLanguage } from "@/lib/i18n/language-context";
import { tierPalette, PAYMENT_PALETTE, type TierPalette } from "@/lib/membership-colors";
import { CardBarcode, CardBrandTab, CardFrame, CardGuilloche } from "@/components/card-bits";
import { SELECTABLE_COUNTRIES } from "@/lib/countries";

// Membership levels priced at or above this are treated as premium "Signature
// Experience" tiers and get the featured, full-width treatment in the form.
const PREMIUM_MIN_PRICE = 2500;

function benefitLines(text?: string | null): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Compact realistic fan-card thumbnail shown inside a selectable level option. */
function LevelOptionThumb({
  tone,
  tierName,
  celebrityName,
  imageUrl,
  accent,
  pal,
  selected = false,
}: {
  tone: "standard" | "vip";
  tierName: string;
  celebrityName: string;
  imageUrl: string | null;
  accent: string;
  pal?: TierPalette;
  selected?: boolean;
}) {
  const gold = "#fcd34d";
  const neon = pal ? pal.accent : tone === "vip" ? gold : "#7dd3fc";
  const bg =
    pal?.bg ??
    (tone === "vip"
      ? "linear-gradient(120deg,#2b1045 0%,#6d28d9 42%,#1f1236 100%)"
      : "linear-gradient(120deg,#0b1330 0%,#1e3a8a 48%,#0b1026 100%)");
  const first = celebrityName.trim().split(/\s+/)[0] ?? "";
  return (
    <div
      className={`relative w-full overflow-hidden rounded-[16px] shadow-lg ring-1 transition ${selected ? "ring-emerald-200/70" : "ring-white/15"}`}
      style={{ background: bg, aspectRatio: "85.6 / 54" }}
    >
      <CardGuilloche color={neon} />
      <div className="pointer-events-none absolute -inset-x-6 -top-10 h-20 rotate-6 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {tone === "vip" && (
        <div className="pointer-events-none absolute -left-6 top-1/3 h-24 w-16 rotate-[24deg] bg-gradient-to-r from-transparent via-amber-200/15 to-transparent" />
      )}
      <CardFrame />
      <div className="relative flex h-full flex-col p-[5.5%]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CardBrandTab />
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white">
              Celebrity<span style={{ color: neon }}>Pass</span>
            </span>
          </div>
          <span className="rounded-full bg-emerald-100/90 px-1.5 py-px text-[6px] font-black uppercase tracking-[0.12em] text-emerald-900">
            Active
          </span>
        </div>
        <div className="mt-[3%] min-h-0 flex-1">
          <p className="truncate text-sm font-black uppercase tracking-[0.1em] text-white">{tierName}</p>
          <p className="text-[6.5px] font-bold uppercase tracking-[0.3em] text-white/70">Official Fan Card</p>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div className="relative h-9 w-8 shrink-0 overflow-hidden rounded-[6px] bg-white/90 p-[1px] shadow-inner">
              <div className="h-full w-full overflow-hidden bg-neutral-200">
                {imageUrl ? (
                  <Image src={imageUrl} alt="" width={32} height={40} className="h-full w-full object-cover object-top" unoptimized />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[10px] font-black text-white" style={{ backgroundColor: accent }}>
                    {first[0] ?? "C"}
                  </div>
                )}
              </div>
            </div>
            <div className="min-w-0">
              {first && <p className="truncate text-[8px] font-black uppercase tracking-[0.08em] text-white">{first.toUpperCase()}</p>}
              <p className="text-[6.5px] font-bold uppercase tracking-[0.18em] text-white/55">Member</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="hidden h-3.5 w-[38px] shrink-0 overflow-hidden rounded-[2px] bg-white/[0.08] px-0.5 text-white/60 ring-1 ring-white/10 sm:block">
              <CardBarcode seed={`thumb:${tierName}:${celebrityName}`} className="opacity-90" />
            </div>
            <span className="shrink-0 text-[7px] font-black uppercase tracking-widest" style={{ color: neon }}>
              {tone === "vip" ? "VIP" : "PREMIUM"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JoinForm({
  slug,
  celebrityName,
  accent,
  memberships,
  imageUrl,
}: {
  slug: string;
  celebrityName: string;
  accent: string;
  memberships: MembershipLevelType[];
  imageUrl: string | null;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetLevel = searchParams.get("level") ?? "";
  const defaultLevel =
    memberships.find((m) => m.id === presetLevel)?.id ?? memberships[0]?.id ?? "";

  const standard = memberships.filter((m) => (m.price ?? 0) < PREMIUM_MIN_PRICE);
  const premium = memberships.filter((m) => (m.price ?? 0) >= PREMIUM_MIN_PRICE);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [level, setLevel] = useState(defaultLevel);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // The three details needed to proceed: a name, a valid email and a country.
  // Once all three are in place, a "Proceed to Payment" step appears instantly
  // right below the fields — no scrolling, no hunting for the button.
  const emailValid = /.+@.+\..+/.test(email.trim());
  const canProceed = name.trim().length > 0 && emailValid && country.trim().length > 0;
  const selectedLevel = memberships.find((m) => m.id === level) ?? memberships[0] ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetchWithTimeout("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celebritySlug: slug, name, email, country, membershipLevelId: level }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("common.somethingWrong"));
        setLoading(false);
        return;
      }
      setLoading(false);
      if (data.requiresPayment && data.payment) {
        router.push(`/checkout/${data.payment.id}`);
        return;
      }
      router.push(`/celebrity/${slug}/fan/${data.card.fanNumber}`);
    } catch {
      setError(t("common.networkError"));
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-base text-white placeholder-zinc-500 outline-none transition focus:border-primary-500";

  return (
    <form onSubmit={submit} className="glass rounded-3xl p-6 sm:p-8">
      {error && (
        <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">{t("join.fullName")}</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder={t("join.namePlaceholder")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">{t("join.email")}</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder={t("join.emailPlaceholder")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">{t("join.country")}</label>
          <select
            required
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={`${inputCls} appearance-none`}
          >
            <option value="" disabled className="bg-ink-800 text-zinc-500">
              {t("join.countryPlaceholder")}
            </option>
            {SELECTABLE_COUNTRIES.map((c) => (
              <option key={c} value={c} className="bg-ink-800 text-white">
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {canProceed && (
        <div
          className="mt-6 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 p-4 transition sm:p-5"
          role="region"
          aria-live="polite"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black text-white">
                {t("join.proceedReady")}
              </p>
              <p className="mt-0.5 text-sm text-emerald-200">
                {selectedLevel
                  ? `${selectedLevel.name} · ${selectedLevel.price != null && selectedLevel.price > 0 ? formatMoney(selectedLevel.price, selectedLevel.currency) : formatMoney(0, selectedLevel.currency)}`
                  : t("join.fanCard", { name: celebrityName })}
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-grad inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? t("join.issuing") : (
                <>
                  {t("join.proceed")}
                  <span aria-hidden>››</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {memberships.length > 0 && (
        <div className="mt-6">
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">{t("join.membershipLevel")}</label>
          {standard.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {standard.map((m, i) => {
                const pal = tierPalette(m.name, i);
                const selected = level === m.id;
                return (
                  <label
                    key={m.id}
                    className={`relative cursor-pointer rounded-2xl border p-4 transition hover:brightness-110 ${
                      selected ? "border-emerald-300 ring-2 ring-emerald-300/60" : "border-white/15 ring-1 ring-white/10"
                    }`}
                    style={{ background: selected ? PAYMENT_PALETTE.bg : pal.bg }}
                  >
                    <input
                      type="radio"
                      name="level"
                      value={m.id}
                      checked={selected}
                      onChange={() => setLevel(m.id)}
                      className="sr-only"
                    />
                    <div className="flex flex-col gap-4">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-white">{m.name}</span>
                          <span className="shrink-0 text-xs font-bold text-white" style={!selected ? { color: pal.accent } : undefined}>
                            {m.price != null && m.price > 0 ? formatMoney(m.price, m.currency) : formatMoney(0, m.currency)}
                          </span>
                        </div>
                        <span className="mt-1 block text-xs leading-relaxed text-white/85">
                          {m.description ?? m.benefits ?? t("join.fanCard", { name: celebrityName })}
                        </span>
                        {selected && (
                          <span className="mt-2 inline-flex w-max items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-800">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            {t("join.readyToPay")}
                          </span>
                        )}
                      </div>
                      <div className="mt-auto">
                        <LevelOptionThumb tone="standard" tierName={m.name} celebrityName={celebrityName} imageUrl={imageUrl} accent={accent} pal={pal} selected={selected} />
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {premium.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">
                {t("membership.signatureExperiences")} · {formatMoney(PREMIUM_MIN_PRICE, "USD")} to {formatMoney(3000000, "USD")}
              </p>
              <div className="space-y-3">
                {premium.map((m, i) => {
                  const selected = level === m.id;
                  const pal = tierPalette(m.name, standard.length + i);
                  return (
                    <label
                      key={m.id}
                      className={`relative block cursor-pointer rounded-2xl border p-4 transition hover:brightness-110 sm:p-5 ${
                        selected ? "border-emerald-300 ring-2 ring-emerald-300/60" : "border-white/15 ring-1 ring-white/10"
                      }`}
                      style={{ background: selected ? PAYMENT_PALETTE.bg : pal.bg }}
                    >
                      <input
                        type="radio"
                        name="level"
                        value={m.id}
                        checked={selected}
                        onChange={() => setLevel(m.id)}
                        className="sr-only"
                      />
                      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="flex items-center gap-2 text-base font-black text-white">
                              {m.name}
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ring-1 ${
                                  selected ? "bg-white/25 text-white ring-white/40" : "bg-white/15 text-white ring-white/30"
                                }`}
                              >
                                Experience
                              </span>
                            </span>
                            <span className="shrink-0 text-base font-black text-white" style={!selected ? { color: pal.accent } : undefined}>
                              {formatMoney(m.price ?? 0, m.currency)}
                            </span>
                          </div>
                          {selected && (
                            <span className="mt-1.5 inline-flex w-max items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-800">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              {t("join.readyToPay")}
                            </span>
                          )}
                          <p className={`mt-1.5 text-sm font-medium ${selected ? "text-white/95" : "text-white/85"}`}>{m.description}</p>
                          <ul className="mt-3 space-y-1.5">
                            {benefitLines(m.benefits ?? m.description).map((line) => (
                              <li key={line} className={`flex items-start gap-2 text-sm leading-relaxed ${selected ? "text-white/90" : "text-white/80"}`}>
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/80" />
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="w-full max-w-[220px] sm:w-44">
                          <LevelOptionThumb tone="vip" tierName={m.name} celebrityName={celebrityName} imageUrl={imageUrl} accent={accent} pal={pal} selected={selected} />
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500">
          {t("join.issuedNote")}
        </p>
        <button
          type="submit"
          disabled={loading}
          className="btn-grad rounded-full px-8 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? t("join.issuing") : t("join.getMyCard")}
        </button>
      </div>
    </form>
  );
}