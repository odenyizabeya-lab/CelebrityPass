"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";
import { LOCALES, type LocaleCode } from "@/lib/i18n/locales";

export default function LanguageSelector() {
  const { locale, setLocale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  // True when automatic browser/device detection is active (no fixed locale
  // saved locally), so the "Automatic" row shows the current-marker.
  const [autoActive, setAutoActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem("celebritypass.locale");
    } catch {
      saved = null;
    }
    setAutoActive(!saved || saved === "__auto__");
  }, [locale]);

  useEffect(() => {
    if (!open) return;
    const onDocumentDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocumentDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocumentDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium ring-1 ring-white/15 transition hover:bg-white/5"
      >
        <span className="text-base leading-none" aria-hidden="true">
          {autoActive ? "🌐" : current.flag}
        </span>
        <span className="hidden text-zinc-200 md:block">
          {autoActive ? t("lang.auto") : current.native}
        </span>
        <svg
          className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute end-0 z-[60] mt-2 max-h-[70vh] w-64 overflow-auto rounded-2xl border border-white/10 bg-ink-900/95 p-1.5 shadow-2xl backdrop-blur-xl"
        >
          <button
            key="auto"
            type="button"
            role="option"
            aria-selected={autoActive}
            onClick={() => {
              setLocale("auto");
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/5 ${
              autoActive ? "text-white" : "text-zinc-300"
            }`}
          >
            <span className="text-base leading-none" aria-hidden="true">
              🌐
            </span>
            <span className="flex-1">
              {t("lang.auto")} · <span className="text-zinc-500">{t("lang.autoHint")}</span>
            </span>
            {autoActive && (
              <svg
                className="h-4 w-4 shrink-0 text-primary-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          <div className="my-1.5 border-t border-white/10" role="separator" />

          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={!autoActive && l.code === locale}
              onClick={() => {
                setLocale(l.code as LocaleCode);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/5 ${
                !autoActive && l.code === locale ? "text-white" : "text-zinc-300"
              }`}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {l.flag}
              </span>
              <span className="flex-1">{l.native}</span>
              {!autoActive && l.code === locale && (
                <svg
                  className="h-4 w-4 shrink-0 text-primary-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}