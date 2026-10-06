"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { fetchWithTimeout } from "@/lib/client-http";
import AuthScreen from "@/components/auth/AuthScreen";
import AuthField from "@/components/auth/AuthField";
import CountrySelect from "@/components/auth/CountrySelect";
import {
  MailIcon,
  LockIcon,
  UserIcon,
  EyeIcon,
  EyeOffIcon,
  AlertIcon,
  Spinner,
  ArrowLeftIcon,
} from "@/components/auth/AuthIcons";
import { appErrorBannerClass, appScreenLinkClass, appPrimaryButtonClass } from "@/components/auth/authStyles";
import { POST_AUTH_DEFAULT, sanitizeNext } from "@/lib/routes";

type FieldErrors = Partial<Record<"name" | "email" | "country" | "password" | "confirm" | "form", string>>;

/**
 * Create-account form.
 *
 * Flow: Full Name -> Email Address -> Select Your Country -> Create Password ->
 * Confirm Password -> Create Account.
 *
 * Notes on the parts that used to be broken:
 *  - Country is a real picker (`CountrySelect`), not a free-text field, so the
 *    account can only ever be created with a canonical country from the
 *    platform list. The server validates it too — see /api/auth/register.
 *  - There is a confirm-password field, and a mismatch blocks submission
 *    client-side so the user never burns a request or an email-verification
 *    burst on a typo.
 *  - Every failure mode maps to a specific, honest message. A dead network no
 *    longer leaves the button spinning forever (the request has a ceiling) and
 *    never leaves the user needing to force-close the app.
 */
export default function RegisterForm() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawNext = searchParams.get("next");
  const redirectTo = sanitizeNext(rawNext) ?? POST_AUTH_DEFAULT;
  const nextQuery = rawNext ? `?next=${encodeURIComponent(redirectTo)}` : "";
  const sessionExpired = searchParams.get("reason") === "expired";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!name || name.trim().length < 2) next.name = t("auth.nameRequired");
    if (!email || !/.+@.+\..+/.test(email.trim())) next.email = t("auth.emailInvalid");
    if (!country) next.country = t("auth.countryRequired");
    if (password.length < 6) next.password = t("auth.passwordShort");
    if (confirm.length < 6) next.confirm = t("auth.confirmPasswordRequired");
    else if (confirm !== password) next.confirm = t("auth.passwordMismatch");
    setErrors(next);
    if (Object.keys(next).length > 0) {
      // Move focus to the first problem so the user is never hunting for it.
      const first = next.name ? "reg-name" : next.email ? "reg-email" : next.country ? "reg-country" : next.password ? "reg-password" : "reg-confirm";
      document.getElementById(first)?.focus();
      return false;
    }
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrors({});
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetchWithTimeout("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, country }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        // A rejected country is a field problem, not a form-wide failure, so
        // send the user straight back to the picker.
        if (res.status === 400 && /country/i.test(data?.error ?? "")) {
          setErrors({ country: t("auth.countryInvalid") });
        } else {
          setErrors({ form: data?.error ?? t("auth.registerFailed") });
        }
        setLoading(false);
        return;
      }

      // `replace` (not `push`) so the back button cannot return to a completed
      // registration form, and `refresh` so the layout re-reads the new session
      // and swaps the app chrome in.
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setErrors({ form: t("common.networkError") });
      setLoading(false);
    }
  };

  const bannerError = errors.form;

  return (
    <AuthScreen
      footer={
        <>
          <p className="text-sm text-zinc-500">
            {t("auth.hasAccount")}{" "}
            <Link href={`/login${nextQuery}`} className={appScreenLinkClass}>
              {t("auth.signIn")}
            </Link>
          </p>
          <p className="text-[11px] leading-relaxed text-zinc-600">
            {t("auth.agree")}{" "}
            <Link href="/legal/terms" className="text-zinc-500 underline transition hover:text-zinc-300">
              {t("auth.termsLink")}
            </Link>{" "}
            {t("auth.and")}{" "}
            <Link href="/legal/privacy" className="text-zinc-500 underline transition hover:text-zinc-300">
              {t("auth.privacyLink")}
            </Link>
            .
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
          {t("common.back")}
        </Link>

        <h1 className="text-3xl font-black tracking-tight sm:text-[2rem]">{t("auth.registerTitle")}</h1>
        <p className="mt-1.5 text-[15px] text-zinc-400">{t("auth.registerSub")}</p>

        {sessionExpired && !bannerError && (
          <div role="status" className="app-screen-fade mt-5 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span className="mt-0.5 shrink-0">
              <AlertIcon />
            </span>
            <span>{t("auth.sessionExpired")}</span>
          </div>
        )}

        {bannerError && (
          <div role="alert" className={appErrorBannerClass}>
            <span className="mt-0.5 shrink-0">
              <AlertIcon />
            </span>
            <span>{bannerError}</span>
          </div>
        )}

        <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
          <AuthField
            id="reg-name"
            label={t("auth.name")}
            icon={<UserIcon />}
            autoComplete="name"
            autoCapitalize="words"
            placeholder={t("auth.nameYour")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "reg-name-error" : undefined}
            required
          />
          {errors.name && (
            <p id="reg-name-error" role="alert" className="-mt-3 text-xs font-medium text-rose-300">
              {errors.name}
            </p>
          )}

          <AuthField
            id="reg-email"
            label={t("auth.email")}
            icon={<MailIcon />}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "reg-email-error" : undefined}
            required
          />
          {errors.email && (
            <p id="reg-email-error" role="alert" className="-mt-3 text-xs font-medium text-rose-300">
              {errors.email}
            </p>
          )}

          <CountrySelect
            id="reg-country"
            label={t("auth.country")}
            locale={locale}
            placeholder={t("auth.countryYour")}
            searchPlaceholder={t("auth.countrySearch")}
            value={country}
            onChange={setCountry}
            invalid={Boolean(errors.country)}
            describedBy={errors.country ? "reg-country-error" : undefined}
          />
          {errors.country && (
            <p id="reg-country-error" role="alert" className="-mt-3 text-xs font-medium text-rose-300">
              {errors.country}
            </p>
          )}

          <AuthField
            id="reg-password"
            label={t("auth.password")}
            icon={<LockIcon />}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder={t("auth.passwordYour")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "reg-password-error" : undefined}
            required
            after={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 transition hover:text-white"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />
          {errors.password && (
            <p id="reg-password-error" role="alert" className="-mt-3 text-xs font-medium text-rose-300">
              {errors.password}
            </p>
          )}

          <AuthField
            id="reg-confirm"
            label={t("auth.confirmPassword")}
            icon={<LockIcon />}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder={t("auth.confirmPasswordYour")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={errors.confirm ? true : undefined}
            aria-describedby={errors.confirm ? "reg-confirm-error" : undefined}
            required
            after={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 transition hover:text-white"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />
          {errors.confirm && (
            <p id="reg-confirm-error" role="alert" className="-mt-3 text-xs font-medium text-rose-300">
              {errors.confirm}
            </p>
          )}

          <button type="submit" disabled={loading} className={appPrimaryButtonClass}>
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
