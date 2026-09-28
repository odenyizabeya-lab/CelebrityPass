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
import { DICTIONARIES } from "./dictionaries";
import {
  DEFAULT_LOCALE,
  LOCALE_AUTO_STORAGE_VALUE,
  LOCALE_STORAGE_KEY,
  isSupportedLocale,
  localeDir,
  normalizeBrowserLanguages,
  resolveInitialLocale,
  type LocaleCode,
} from "./locales";

export type TranslateVars = Record<string, string | number>;

type Translate = (key: string, vars?: TranslateVars) => string;

type AutoLocale = LocaleCode | "auto";

type SetLocaleFn = (code: AutoLocale) => Promise<void> | void;

interface LanguageContextValue {
  locale: LocaleCode;
  dir: "ltr" | "rtl";
  t: Translate;
  setLocale: SetLocaleFn;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

declare global {
  interface Window {
    /** Set by the inline pre-hydration script in app/layout.tsx. */
    __CP_INITIAL_LOCALE__?: string;
  }
}

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

  // Seed the state synchronously from the pre-hydration bootstrap script so
  // the very first client render already uses the right language — no flash.
  const [locale, setLocaleState] = useState<LocaleCode>(() => {
    if (typeof window === "undefined") return fallback;
    const boot = window.__CP_INITIAL_LOCALE__;
    return isSupportedLocale(boot) ? boot : fallback;
  });

  // After hydration, respect a saved local choice (which the bootstrap script
  // already honors) and, for signed-in visitors with no local choice, pull the
  // account's preferred language once. Auto/device mode is honoured.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (saved === LOCALE_AUTO_STORAGE_VALUE) saved = null;
    if (saved && isSupportedLocale(saved)) {
      if (saved !== locale) queueMicrotask(() => setLocaleState(saved as LocaleCode));
      return;
    }
    // No local preference → apply the signed-in account's stored language if
    // it has one; otherwise keep the browser-based auto detection.
    const controller = new AbortController();
    fetch("/api/auth/me", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { fan?: { preferredLocale?: string | null } } | null) => {
        const code = data?.fan?.preferredLocale;
        if (code && isSupportedLocale(code) && code !== locale) {
          setLocaleState(code as LocaleCode);
        }
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDir(locale);
  }, [locale]);

  /** Resolve a language from the browser/device when "auto" is active. */
  const resolveAuto = useCallback((): LocaleCode => {
    const boot = typeof window !== "undefined" ? window.__CP_INITIAL_LOCALE__ : undefined;
    if (boot && isSupportedLocale(boot)) return boot as LocaleCode;
    return resolveInitialLocale(
      null,
      serverCountry ?? null,
      normalizeBrowserLanguages(navigator.languages),
    );
  }, [serverCountry]);

  const t = useCallback<Translate>(
    (key, vars) => {
      const dict = DICTIONARIES[locale];
      let value = dict ? deepGet(dict, key) : null;
      if (value == null && locale !== "en") value = deepGet(en, key);
      if (value == null) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[i18n] Missing translation key: "${key}" (locale: ${locale})`);
        }
        return key;
      }
      return interpolate(value, vars);
    },
    [locale],
  );

  const setLocale = useCallback<SetLocaleFn>(
    (code) => {
      if (code === "auto") {
        // Return to automatic browser/device detection. Store the sentinel and
        // resolve immediately from the browser languages so the app reacts now.
        const next = resolveAuto();
        setLocaleState(next);
        try {
          window.localStorage.setItem(LOCALE_STORAGE_KEY, LOCALE_AUTO_STORAGE_VALUE);
        } catch {
          // Storage may be unavailable (private mode); the choice still applies.
        }
        return;
      }
      setLocaleState(code);
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, code);
      } catch {
        // Storage may be unavailable (private mode); the choice still applies.
      }
    },
    [resolveAuto],
  );

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

export function useLocale(): LocaleCode {
  return useLanguage().locale;
}

export function useT(): Translate {
  return useLanguage().t;
}

export default LanguageProvider;