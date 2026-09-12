"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";

export default function ForgotEmailForm() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const safeNext =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\")
      ? rawNext
      : "/login";
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "none">("idle");
  const [maskedEmail, setMaskedEmail] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/forgot-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, country }),
      });
      const data = await res.json();
      if (data?.ok && data.maskedEmail) {
        setMaskedEmail(data.maskedEmail);
        setStatus("found");
      } else {
        setStatus("none");
      }
    } catch {
      setStatus("none");
    }
  };

  return (
    <form onSubmit={submit} className="glass mx-auto max-w-md rounded-3xl p-8">
      <h1 className="text-2xl font-black tracking-tight">{t("auth.forgotEmailTitle")}</h1>
      <p className="mt-1 text-sm text-zinc-400">{t("auth.forgotEmailSub")}</p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">{t("auth.forgotEmailName")}</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-cp"
            placeholder={t("auth.forgotEmailName")}
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
          disabled={status === "loading"}
          className="btn-grad w-full rounded-full py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {status === "loading" ? t("auth.forgotEmailChecking") : t("auth.forgotEmailSubmit")}
        </button>
      </div>

      {status === "found" && (
        <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {t("auth.forgotEmailFound", { email: maskedEmail })}
        </div>
      )}
      {status === "none" && (
        <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {t("auth.forgotEmailNotFound")}
        </div>
      )}

      <p className="mt-5 text-center text-xs text-zinc-500">
        <a href={`/login?next=${encodeURIComponent(safeNext)}`} className="text-primary-400 hover:text-primary-300">
          {t("auth.forgotEmailBack")}
        </a>
      </p>
    </form>
  );
}