"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-white/[0.06] bg-ink-950/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary-600 to-accent-500 text-xs font-black text-white">
              CP
            </span>
            <span className="text-lg font-bold tracking-tight">
              Celebrity<span className="gradient-text">Pass</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-400">
            {t("footer.tagline")}
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white">{t("footer.explore")}</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
            <li><Link href="/" className="transition hover:text-white">{t("footer.home")}</Link></li>
            <li><Link href="/about" className="transition hover:text-white">{t("footer.about")}</Link></li>
            <li><Link href="/celebrities" className="transition hover:text-white">{t("footer.directory")}</Link></li>
            <li><Link href="/discovery" className="transition hover:text-white">{t("footer.eventDiscovery")}</Link></li>
            <li><Link href="/#how-it-works" className="transition hover:text-white">{t("footer.howItWorks")}</Link></li>
            <li><Link href="/#membership" className="transition hover:text-white">{t("footer.membershipLevels")}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white">{t("footer.account")}</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
            <li><Link href="/dashboard" className="transition hover:text-white">{t("footer.fanDashboard")}</Link></li>
            <li><Link href="/account" className="transition hover:text-white">{t("footer.accountSettings")}</Link></li>
            <li><Link href="/login" className="transition hover:text-white">{t("footer.login")}</Link></li>
            <li><Link href="/register" className="transition hover:text-white">{t("footer.register")}</Link></li>
            <li><Link href="/download" className="transition hover:text-white">{t("footer.appDownload")}</Link></li>
            <li><Link href="/faq" className="transition hover:text-white">{t("nav.faq")}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white">{t("footer.legal")}</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-zinc-400">
            <li><Link href="/legal" className="transition hover:text-white">{t("footer.legalSupport")}</Link></li>
            <li><Link href="/faq" className="transition hover:text-white">{t("nav.faq")}</Link></li>
            <li><Link href="/legal/privacy" className="transition hover:text-white">{t("footer.privacyPolicy")}</Link></li>
            <li><Link href="/legal/terms" className="transition hover:text-white">{t("footer.termsOfService")}</Link></li>
            <li><Link href="/legal/payments" className="transition hover:text-white">{t("footer.paymentsRefunds")}</Link></li>
            <li><Link href="/security" className="transition hover:text-white">{t("footer.securityTrust")}</Link></li>
            <li><Link href="/legal/rights" className="transition hover:text-white">{t("footer.userRights")}</Link></li>
            <li><Link href="/help" className="transition hover:text-white">{t("footer.helpCenter")}</Link></li>
            <li><Link href="/legal/contact" className="transition hover:text-white">{t("footer.contactSupport")}</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:px-6">
          <p>&copy; {new Date().getFullYear()} CelebrityPass. {t("footer.rightsReserved")}</p>
          <p>{t("footer.statsNote")}</p>
        </div>
      </div>
    </footer>
  );
}