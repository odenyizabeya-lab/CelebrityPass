"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { MembershipLevelType } from "@/lib/utils";
import { formatMoney } from "@/lib/payments";
import Logo from "@/components/Logo";
import { useLanguage } from "@/lib/i18n/language-context";

const COUNTRIES = [
  "Afghanistan", "Argentina", "Australia", "Austria", "Bangladesh", "Belgium", "Brazil", "Canada", "Chile", "China",
  "Colombia", "Croatia", "Czech Republic", "Denmark", "Egypt", "Finland", "France", "Germany", "Ghana", "Greece",
  "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Ireland", "Israel", "Italy", "Japan", "Kenya", "Malaysia",
  "Mexico", "Morocco", "Netherlands", "New Zealand", "Nigeria", "Norway", "Pakistan", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Russia", "Saudi Arabia", "Singapore", "South Africa", "South Korea", "Spain",
  "Sri Lanka", "Sweden", "Switzerland", "Taiwan", "Thailand", "Türkiye", "Ukraine", "United Arab Emirates",
  "United Kingdom", "United States", "Vietnam",
];

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
}: {
  tone: "standard" | "vip";
  tierName: string;
  celebrityName: string;
  imageUrl: string | null;
  accent: string;
}) {
  const gold = "#fcd34d";
  const neon = tone === "vip" ? gold : "#7dd3fc";
  const bg =
    tone === "vip"
      ? "linear-gradient(120deg,#2b1045 0%,#6d28d9 42%,#1f1236 100%)"
      : "linear-gradient(120deg,#0b1330 0%,#1e3a8a 48%,#0b1026 100%)";
  const first = celebrityName.trim().split(/\s+/)[0] ?? "";
  return (
    <div className="relative w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-white/15" style={{ background: bg, aspectRatio: "1.62 / 1" }}>
      <div className="pointer-events-none absolute -inset-x-6 -top-10 h-20 rotate-6 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {tone === "vip" && (
        <div className="pointer-events-none absolute -left-6 top-1/3 h-24 w-16 rotate-[24deg] bg-gradient-to-r from-transparent via-amber-200/15 to-transparent" />
      )}
      <div className="relative flex h-full flex-col justify-between p-2.5">
        <div className="flex items-start justify-between">
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white">
            Celebrity<span style={{ color: neon }}>Pass</span>
          </span>
          <span className="grid h-5 w-5 place-items-center rounded-md bg-white text-[8px] font-black text-ink-900 shadow">
            <Logo size="xs" className="rounded-md shadow-md" />
          </span>
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-[0.1em] text-white">{tierName}</p>
          <p className="text-[7px] font-bold uppercase tracking-[0.32em] text-white/70">Official Fan Card</p>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-md ring-1 ring-white/40">
              {imageUrl ? (
                <Image src={imageUrl} alt="" width={28} height={36} className="h-full w-full object-cover" unoptimized />
              ) : (
                <div className="grid h-full w-full place-items-center text-[10px] font-black text-white" style={{ backgroundColor: accent }}>
                  {first[0] ?? "C"}
                </div>
              )}
            </div>
            <div>
              {first && <p className="text-[8px] font-black uppercase tracking-[0.08em] text-white">{first.toUpperCase()}</p>}
              <p className="text-[7px] font-bold uppercase tracking-[0.18em] text-white/55">Member</p>
            </div>
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: neon }}>
            {tone === "vip" ? "VIP" : "PREMIUM"}
          </span>
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
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [level, setLevel] = useState(defaultLevel);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celebritySlug: slug, name, email, password, country, membershipLevelId: level }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("common.somethingWrong"));
        setLoading(false);
        return;
      }
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
    "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500";

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
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">
            {t("join.password")} <span className="font-normal text-zinc-500">{t("common.optional")}</span>
          </label>
          <input
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder={t("join.passwordHint")}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">{t("join.country")}</label>
          <input
            required
            list="country-list"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={inputCls}
            placeholder={t("join.countryPlaceholder")}
          />
          <datalist id="country-list">
            {COUNTRIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      {memberships.length > 0 && (
        <div className="mt-6">
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">{t("join.membershipLevel")}</label>
          {standard.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {standard.map((m) => (
                <label
                  key={m.id}
                  className={`relative cursor-pointer rounded-2xl border p-4 transition ${
                    level === m.id
                      ? "border-transparent text-white"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                  style={
                    level === m.id
                      ? { backgroundImage: `linear-gradient(135deg, ${accent}, ${accent}B3)`, boxShadow: `0 12px 36px ${accent}59` }
                      : undefined
                  }
                >
                  <input
                    type="radio"
                    name="level"
                    value={m.id}
                    checked={level === m.id}
                    onChange={() => setLevel(m.id)}
                    className="sr-only"
                  />
                  <div className="flex flex-col gap-4">
                    <div>
                      <span className={`text-sm font-bold ${level === m.id ? "text-white" : ""}`} style={level === m.id ? undefined : { color: accent }}>
                        {m.name}
                      </span>
                      <span className={`ml-1.5 text-xs font-bold ${level === m.id ? "text-white/95" : "text-emerald-300"}`}>
                        {m.price != null && m.price > 0 ? formatMoney(m.price, m.currency) : formatMoney(0, m.currency)}
                      </span>
                      <span className={`mt-1 block text-xs leading-relaxed ${level === m.id ? "text-white/85" : "text-zinc-400"}`}>
                        {m.description ?? m.benefits ?? t("join.fanCard", { name: celebrityName })}
                      </span>
                    </div>
                    <div className="mt-auto">
                      <LevelOptionThumb tone="standard" tierName={m.name} celebrityName={celebrityName} imageUrl={imageUrl} accent={accent} />
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {premium.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">
                {t("membership.signatureExperiences")} · {formatMoney(PREMIUM_MIN_PRICE, "USD")} to {formatMoney(3000000, "USD")}
              </p>
              <div className="space-y-3">
                {premium.map((m) => {
                  const selected = level === m.id;
                  return (
                    <label
                      key={m.id}
                      className={`relative block cursor-pointer rounded-2xl border p-4 transition sm:p-5 ${
                        selected
                          ? "border-transparent text-ink-900 shadow-[0_14px_44px_rgba(251,191,36,0.35)]"
                          : "border-white/10 bg-white/[0.03] hover:border-amber-400/40"
                      }`}
                      style={selected ? { background: "linear-gradient(120deg,#fbbf24,#f59e0b,#f97316)" } : undefined}
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
                            <span className={`flex items-center gap-2 text-base font-black ${selected ? "text-ink-900" : "text-white"}`}>
                              {m.name}
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ring-1 ${
                                  selected ? "bg-ink-900/15 text-ink-900 ring-ink-900/30" : "bg-amber-400/15 text-amber-300 ring-amber-400/30"
                                }`}
                              >
                                Experience
                              </span>
                            </span>
                            <span className={`text-base font-black ${selected ? "text-ink-900" : "text-amber-300"}`}>
                              {formatMoney(m.price ?? 0, m.currency)}
                            </span>
                          </div>
                          <p className={`mt-1.5 text-sm font-medium ${selected ? "text-ink-900/80" : "text-zinc-300"}`}>{m.description}</p>
                          <ul className="mt-3 space-y-1.5">
                            {benefitLines(m.benefits ?? m.description).map((line) => (
                              <li key={line} className={`flex items-start gap-2 text-sm leading-relaxed ${selected ? "text-ink-900/75" : "text-zinc-400"}`}>
                                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${selected ? "bg-ink-900/80" : "bg-amber-400/80"}`} />
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="w-full max-w-[220px] sm:w-44">
                          <LevelOptionThumb tone="vip" tierName={m.name} celebrityName={celebrityName} imageUrl={imageUrl} accent={accent} />
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