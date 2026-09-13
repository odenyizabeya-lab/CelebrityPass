"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { fetchWithTimeout } from "@/lib/client-http";
import AuthScreen from "@/components/auth/AuthScreen";
import AuthField from "@/components/auth/AuthField";
import { UserIcon, GlobeIcon, AlertIcon, Spinner, ArrowLeftIcon } from "@/components/auth/AuthIcons";
import {
  appScreenLinkClass,
  appPrimaryButtonClass,
  appErrorBannerClass,
  appSuccessBannerClass,
} from "@/components/auth/authStyles";

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
      const res = await fetchWithTimeout("/api/auth/forgot-email", {
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
    <AuthScreen
      footer={
        <p className="text-sm text-zinc-500">
          <a href={`/login?next=${encodeURIComponent(safeNext)}`} className={appScreenLinkClass}>
            {t("auth.forgotEmailBack")}
          </a>
        </p>
      }
    >
      <div className="app-screen-in">
        <a
          href="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition hover:text-white"
        >
          <ArrowLeftIcon />
          Back
        </a>
        <h1 className="text-3xl font-black tracking-tight sm:text-[2rem]">{t("auth.forgotEmailTitle")}</h1>
        <p className="mt-1.5 text-[15px] text-zinc-400">{t("auth.forgotEmailSub")}</p>

        {status === "found" && (
          <div role="status" className={`${appSuccessBannerClass} mt-6`}>
            {t("auth.forgotEmailFound", { email: maskedEmail })}
          </div>
        )}
        {status === "none" && (
          <div role="alert" className={`${appErrorBannerClass} mt-6`}>
            <span className="mt-0.5 shrink-0"><AlertIcon /></span>
            <span>{t("auth.forgotEmailNotFound")}</span>
          </div>
        )}

        <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
          <AuthField
            id="forgot-name"
            label={t("auth.forgotEmailName")}
            icon={<UserIcon />}
            autoComplete="given-name"
            placeholder={t("auth.forgotEmailName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <AuthField
            id="forgot-country"
            label={t("auth.country")}
            icon={<GlobeIcon />}
            autoComplete="country-name"
            placeholder={t("auth.countryYour")}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <button type="submit" disabled={status === "loading"} className={appPrimaryButtonClass}>
            {status === "loading" ? (
              <>
                <Spinner />
                {t("auth.forgotEmailChecking")}
              </>
            ) : (
              t("auth.forgotEmailSubmit")
            )}
          </button>
        </form>
      </div>
    </AuthScreen>
  );
}