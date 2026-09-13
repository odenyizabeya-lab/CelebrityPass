"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { fetchWithTimeout } from "@/lib/client-http";
import AuthScreen from "@/components/auth/AuthScreen";
import AuthField from "@/components/auth/AuthField";
import {
  MailIcon,
  LockIcon,
  UserIcon,
  GlobeIcon,
  EyeIcon,
  EyeOffIcon,
  AlertIcon,
  Spinner,
  ArrowLeftIcon,
} from "@/components/auth/AuthIcons";
import { appErrorBannerClass, appScreenLinkClass, appPrimaryButtonClass } from "@/components/auth/authStyles";

export default function RegisterForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const redirectTo =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\")
      ? rawNext
      : "/onboarding/celebrities";
  const nextQuery = rawNext ? `?next=${encodeURIComponent(redirectTo)}` : "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || name.length < 2) {
      setError(t("auth.nameRequired"));
      return;
    }
    if (!email || !/.+@.+\..+/.test(email)) {
      setError(t("auth.emailInvalid"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.passwordShort"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithTimeout("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, country }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("auth.registerFailed"));
        setLoading(false);
        return;
      }
      setLoading(false);
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError(t("common.networkError"));
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      footer={
        <>
          <p className="text-sm text-zinc-500">
            {t("auth.hasAccount")}{" "}
            <a href={`/login${nextQuery}`} className={appScreenLinkClass}>
              {t("auth.signIn")}
            </a>
          </p>
          <p className="text-[11px] leading-relaxed text-zinc-600">
            {t("auth.agree")}{" "}
            <a href="/legal/terms" className="text-zinc-500 underline transition hover:text-zinc-300">
              {t("auth.termsLink")}
            </a>{" "}
            {t("auth.and")}{" "}
            <a href="/legal/privacy" className="text-zinc-500 underline transition hover:text-zinc-300">
              {t("auth.privacyLink")}
            </a>.
          </p>
        </>
      }
    >
      <div className="app-screen-in">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition hover:text-white"
        >
          <ArrowLeftIcon />
          Back
        </Link>

        <h1 className="text-3xl font-black tracking-tight sm:text-[2rem]">{t("auth.registerTitle")}</h1>
        <p className="mt-1.5 text-[15px] text-zinc-400">{t("auth.registerSub")}</p>

        {error && (
          <div role="alert" className={appErrorBannerClass}>
            <span className="mt-0.5 shrink-0"><AlertIcon /></span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
          <AuthField
            id="reg-name"
            label={t("auth.name")}
            icon={<UserIcon />}
            autoComplete="given-name"
            placeholder={t("auth.nameYour")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <AuthField
            id="reg-country"
            label={t("auth.country")}
            icon={<GlobeIcon />}
            autoComplete="country-name"
            placeholder={t("auth.countryYour")}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <AuthField
            id="reg-email"
            label={t("auth.email")}
            icon={<MailIcon />}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <AuthField
            id="reg-password"
            label={t("auth.password")}
            icon={<LockIcon />}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder={t("auth.passwordShort")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            after={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 transition hover:text-white"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />

          <button
            type="submit"
            disabled={loading}
            className={appPrimaryButtonClass}
          >
            {loading ? (
              <>
                <Spinner />
                {t("auth.creatingAccount")}
              </>
            ) : (
              t("auth.createAccount")
            )}
          </button>
        </form>
      </div>
    </AuthScreen>
  );
}