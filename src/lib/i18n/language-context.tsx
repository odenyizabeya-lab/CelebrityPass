"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./dictionaries/en";
import { zhHans } from "./dictionaries/zh-Hans";
import { es } from "./dictionaries/es";
import { fr } from "./dictionaries/fr";
import { ar } from "./dictionaries/ar";
import { hi } from "./dictionaries/hi";
import { coreDictionaries } from "./dictionaries/core";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isSupportedLocale,
  localeDir,
  normalizeBrowserLanguages,
  resolveInitialLocale,
  type LocaleCode,
} from "./locales";

const DICTIONARIES: Record<string, unknown> = {
  en,
  "zh-Hans": zhHans,
  es,
  fr,
  ar,
  hi,
  de: coreDictionaries.de,
  pt: coreDictionaries.pt,
  ja: coreDictionaries.ja,
  ko: coreDictionaries.ko,
  it: coreDictionaries.it,
  ru: coreDictionaries.ru,
  tr: coreDictionaries.tr,
  nl: coreDictionaries.nl,
  id: coreDictionaries.id,
  vi: coreDictionaries.vi,
  th: coreDictionaries.th,
  pl: coreDictionaries.pl,
  uk: coreDictionaries.uk,
  sw: coreDictionaries.sw,
};

export type TranslateVars = Record<string, string | number>;

type Translate = (key: string, vars?: TranslateVars) => string;

interface LanguageContextValue {
  locale: LocaleCode;
  dir: "ltr" | "rtl";
  t: Translate;
  setLocale: (code: LocaleCode) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function deepGet(obj: unknown, path: string): string | null {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return typeof cur === "string" ? cur : null;
}

function interpolate(value: string, vars?: TranslateVars): string {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function LanguageProvider({
  initialLocale,
  serverCountry,
  children,
}: {
  initialLocale?: LocaleCode;
  serverCountry?: string | null;
  children: ReactNode;
}) {
  const fallback: LocaleCode = isSupportedLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE;
  const [locale, setLocaleState] = useState<LocaleCode>(fallback);

  // After hydration, re-resolve with the real browser language list and any
  // saved choice. SSR used initialLocale (country + Accept-Language).
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      saved = null;
    }
    const resolved = resolveInitialLocale(
      saved,
      serverCountry ?? null,
      normalizeBrowserLanguages(navigator.languages),
    );
    // Defer the state update off the synchronous effect body. The hydration
    // pass re-renders before the browser paints, so no visible flash.
    if (resolved !== fallback) queueMicrotask(() => setLocaleState(resolved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDir(locale);
  }, [locale]);

  const t = useCallback<Translate>(
    (key, vars) => {
      const dict = DICTIONARIES[locale];
      let value = deepGet(dict, key);
      if (value == null && locale !== "en") value = deepGet(en, key);
      if (value == null) return key;
      return interpolate(value, vars);
    },
    [locale],
  );

  const setLocale = useCallback((code: LocaleCode) => {
    setLocaleState(code);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, code);
    } catch {
      // Storage may be unavailable (private mode); the choice still applies.
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, dir: localeDir(locale), t, setLocale }),
    [locale, t, setLocale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}

export function useT(): Translate {
  return useLanguage().t;
}

export default LanguageProvider;