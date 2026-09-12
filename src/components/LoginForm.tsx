"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
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
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError(t("common.networkError"));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass mx-auto max-w-md rounded-3xl p-8">
      <h1 className="text-2xl font-black tracking-tight">{t("auth.loginTitle")}</h1>
      <p className="mt-1 text-sm text-zinc-400">{t("auth.loginSub")}</p>

      {error && (
        <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">{t("auth.email")}</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
            placeholder={t("auth.emailPlaceholder")}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">{t("auth.password")}</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
            placeholder={t("auth.passwordYour")}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-grad w-full rounded-full py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-zinc-500">
        <a href="/reset-password" className="text-zinc-400 underline hover:text-white">{t("auth.forgotPassword")}</a>{" "}
        ·{" "}
        <a href={`/forgot-email${nextQuery}`} className="text-zinc-400 underline hover:text-white">{t("auth.forgotEmail")}</a>
      </p>

      <p className="mt-4 text-center text-xs text-zinc-500">
        {t("auth.noAccount")}{" "}
        <a href={`/register${nextQuery}`} className="text-primary-400 hover:text-primary-300">{t("auth.createOne")}</a>.
      </p>
    </form>
  );
}