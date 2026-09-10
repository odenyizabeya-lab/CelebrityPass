"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { MembershipLevelType } from "@/lib/utils";
import { formatMoney } from "@/lib/payments";
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

export default function JoinForm({
  slug,
  celebrityName,
  accent,
  memberships,
}: {
  slug: string;
  celebrityName: string;
  accent: string;
  memberships: MembershipLevelType[];
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
            <div className="grid gap-3 sm:grid-cols-3">
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
                  <span className={`text-sm font-bold ${level === m.id ? "text-white" : ""}`} style={level === m.id ? undefined : { color: accent }}>
                    {m.name}
                  </span>
                  <span className={`ml-1.5 text-xs font-bold ${level === m.id ? "text-white/95" : "text-emerald-300"}`}>
                    {m.price != null && m.price > 0 ? formatMoney(m.price, m.currency) : formatMoney(0, m.currency)}
                  </span>
                  <span className={`mt-1 block text-xs leading-relaxed ${level === m.id ? "text-white/85" : "text-zinc-400"}`}>
                    {m.description ?? m.benefits ?? t("join.fanCard", { name: celebrityName })}
                  </span>
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
                      className={`relative block cursor-pointer rounded-2xl border p-5 transition ${
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