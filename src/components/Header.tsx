"use client";

import Link from "next/link";
import { useState } from "react";
import LanguageSelector from "@/components/LanguageSelector";
import { useLanguage } from "@/lib/i18n/language-context";

export default function Header() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/celebrities", label: t("nav.celebrities") },
    { href: "/discovery", label: t("nav.events") },
    { href: "/#how-it-works", label: t("nav.howItWorks") },
    { href: "/#membership", label: t("nav.membership") },
    { href: "/faq", label: t("nav.faq") },
    { href: "/dashboard", label: t("nav.myCards") },
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-900/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary-600 to-accent-500 text-xs font-black text-white shadow-lg shadow-primary-600/30 ring-1 ring-white/20">
            CP
          </span>
          <span className="text-lg font-bold tracking-tight">
            Celebrity<span className="gradient-text">Pass</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-medium text-zinc-300 md:flex">
          {links.slice(0, 5).map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-4 py-2 transition hover:bg-white/5 hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSelector />
          <Link
            href="/dashboard"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-white/15 transition hover:bg-white/5 sm:block"
          >
            {t("nav.myCards")}
          </Link>
          <Link
            href="/celebrities"
            className="btn-grad rounded-full px-4 py-2 text-sm font-semibold text-white"
          >
            {t("nav.findFanCard")}
          </Link>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full text-xl font-black leading-none text-white ring-1 ring-white/15 transition hover:bg-white/5"
          >
            {open ? "×" : "≡"}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-white/[0.06] bg-ink-900/95 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}