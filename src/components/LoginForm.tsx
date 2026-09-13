"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { fetchWithTimeout } from "@/lib/client-http";
import AuthScreen from "@/components/auth/AuthScreen";
import AuthField from "@/components/auth/AuthField";
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, AlertIcon, Spinner, ArrowLeftIcon } from "@/components/auth/AuthIcons";
import { appScreenLinkClass } from "@/components/auth/authStyles";

export default function LoginForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only same-site relative paths are allowed to redirect after sign-in.
  const rawNext = searchParams.get("next");
  const redirectTo =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\") ? rawNext : "/dashboard";
  const nextQuery = rawNext ? `?next=${encodeURIComponent(redirectTo)}` : "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetchWithTimeout("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("auth.loginFailed"));
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
            {t("auth.noAccount")}{" "}
            <a href={`/register${nextQuery}`} className={appScreenLinkClass}>
              {t("auth.createOne")}
            </a>
          </p>
          <p className="text-[11px] leading-relaxed text-zinc-600">
            Official fan communities · Digital fan cards · VIP experiences
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

        <h1 className="text-3xl font-black tracking-tight sm:text-[2rem]">{t("auth.loginTitle")}</h1>
        <p className="mt-1.5 text-[15px] text-zinc-400">{t("auth.loginSub")}</p>

        {error && (
          <div
            role="alert"
            className="app-screen-fade mt-5 flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          >
            <span className="mt-0.5 shrink-0"><AlertIcon /></span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
          <AuthField
            id="login-email"
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
            id="login-password"
            label={t("auth.password")}
            icon={<LockIcon />}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder={t("auth.passwordYour")}
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

          <div className="flex items-center justify-between gap-2 text-[13px]">
            <a href={`/forgot-email${nextQuery}`} className="text-zinc-400 transition hover:text-white">
              {t("auth.forgotEmail")}
            </a>
            <a href="/reset-password" className="font-semibold text-primary-400 transition hover:text-primary-300">
              {t("auth.forgotPassword")}
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-grad flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white shadow-xl shadow-primary-600/25 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Spinner />
                {t("auth.signingIn")}
              </>
            ) : (
              t("auth.signIn")
            )}
          </button>
        </form>
      </div>
    </AuthScreen>
  );
}