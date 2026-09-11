"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";

export default function RegisterForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const res = await fetch("/api/auth/register", {
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
      router.push("/onboarding/celebrities");
      router.refresh();
    } catch {
      setError(t("common.networkError"));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass mx-auto max-w-md rounded-3xl p-8">
      <h1 className="text-2xl font-black tracking-tight">{t("auth.registerTitle")}</h1>
      <p className="mt-1 text-sm text-zinc-400">{t("auth.registerSub")}</p>

      {error && (
        <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">{t("auth.name")}</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-cp"
            placeholder={t("auth.nameYour")}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">{t("auth.email")}</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-cp"
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
            className="field-cp"
            placeholder={t("auth.passwordShort")}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">{t("auth.country")}</label>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="field-cp"
            placeholder={t("auth.countryYour")}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-grad w-full rounded-full py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
        </button>
      </div>

      <p className="mt-5 text-center text-xs text-zinc-500">
        {t("auth.hasAccount")}{" "}
        <a href="/login" className="text-primary-400 hover:text-primary-300">{t("auth.signIn")}</a>
      </p>
      <p className="mt-3 text-center text-xs text-zinc-600">
        {t("auth.agree")}{" "}
        <a href="/legal/terms" className="text-zinc-500 underline">{t("auth.termsLink")}</a> {t("auth.and")}{" "}
        <a href="/legal/privacy" className="text-zinc-500 underline">{t("auth.privacyLink")}</a>.
      </p>
    </form>
  );
}