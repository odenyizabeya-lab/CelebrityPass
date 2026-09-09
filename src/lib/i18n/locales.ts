/**
 * Language & location catalog for CelebrityPass.
 *
 * 22 supported languages. Country detection (via the Vercel/Cloudflare
 * per-request country header) maps each country to its main language; the
 * visitor's browser language is used for multi-language countries and as the
 * universal fallback. Everything is free and local — no translation APIs, no
 * API keys, no subscriptions. Store selections locally so future visits keep
 * the visitor's own choice.
 */

export const LOCALES = [
  { code: "en", native: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "zh-Hans", native: "简体中文", flag: "🇨🇳", dir: "ltr" },
  { code: "es", native: "Español", flag: "🇪🇸", dir: "ltr" },
  { code: "fr", native: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "de", native: "Deutsch", flag: "🇩🇪", dir: "ltr" },
  { code: "pt", native: "Português", flag: "🇵🇹", dir: "ltr" },
  { code: "ar", native: "العربية", flag: "🇸🇦", dir: "rtl" },
  { code: "hi", native: "हिन्दी", flag: "🇮🇳", dir: "ltr" },
  { code: "ja", native: "日本語", flag: "🇯🇵", dir: "ltr" },
  { code: "ko", native: "한국어", flag: "🇰🇷", dir: "ltr" },
  { code: "it", native: "Italiano", flag: "🇮🇹", dir: "ltr" },
  { code: "ru", native: "Русский", flag: "🇷🇺", dir: "ltr" },
  { code: "tr", native: "Türkçe", flag: "🇹🇷", dir: "ltr" },
  { code: "nl", native: "Nederlands", flag: "🇳🇱", dir: "ltr" },
  { code: "id", native: "Bahasa Indonesia", flag: "🇮🇩", dir: "ltr" },
  { code: "vi", native: "Tiếng Việt", flag: "🇻🇳", dir: "ltr" },
  { code: "th", native: "ไทย", flag: "🇹🇭", dir: "ltr" },
  { code: "pl", native: "Polski", flag: "🇵🇱", dir: "ltr" },
  { code: "uk", native: "Українська", flag: "🇺🇦", dir: "ltr" },
  { code: "sw", native: "Kiswahili", flag: "🇰🇪", dir: "ltr" },
  { code: "yo", native: "Yorùbá", flag: "🇳🇬", dir: "ltr" },
  { code: "ig", native: "Igbo", flag: "🇳🇬", dir: "ltr" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: LocaleCode = "en";
export const SUPPORTED_LOCALES: readonly string[] = LOCALES.map((l) => l.code);

/** The visitor-facing localStorage key that remembers their own choice. */
export const LOCALE_STORAGE_KEY = "celebritypass.locale";

export function isSupportedLocale(code: string | null | undefined): code is LocaleCode {
  return !!code && (SUPPORTED_LOCALES as readonly string[]).includes(code);
}

export function localeDir(code: string): "ltr" | "rtl" {
  return LOCALES.find((l) => l.code === code)?.dir ?? "ltr";
}

/**
 * Countries whose official/main language is English. Visitors from these
 * countries always see English, regardless of their browser language.
 */
export const ENGLISH_COUNTRY_CODES = new Set([
  "US", "GB", "AU", "CA", "NZ", "IE", "NG", "GH", "ZA", "KE", "TZ", "UG", "ZM", "ZW", "GM", "SL",
  "LR", "BW", "NA", "MW", "JM", "TT", "BB", "GY", "BS", "BZ", "GD", "KN", "LC", "VC", "SG", "PH",
  "MY", "HK", "IN", "PK", "BD", "LK", "NP", "FJ", "PG", "SB", "VU",
]);

/** Country (ISO 3166-1 alpha-2) → its single main language. Strong rule. */
export const COUNTRY_TO_LOCALE: Record<string, string> = {
  CN: "zh-Hans",
  TW: "zh-Hans",
  FR: "fr",
  ES: "es",
  MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es", EC: "es", UY: "es", PY: "es",
  BO: "es", GT: "es", CU: "es", DO: "es", HN: "es", SV: "es", NI: "es", CR: "es", PA: "es", PR: "es",
  DE: "de",
  AT: "de",
  JP: "ja",
  KR: "ko",
  IT: "it",
  RU: "ru",
  TR: "tr",
  NL: "nl",
  ID: "id",
  VN: "vi",
  TH: "th",
  PL: "pl",
  UA: "uk",
  PT: "pt", BR: "pt", AO: "pt", MZ: "pt",
  SA: "ar", AE: "ar", EG: "ar", IQ: "ar", JO: "ar", KW: "ar", LB: "ar", LY: "ar", MA: "ar",
  OM: "ar", QA: "ar", SD: "ar", SY: "ar", YE: "ar", PS: "ar", BH: "ar", MR: "ar", DZ: "ar", TN: "ar",
};

/**
 * Multi-language countries where the visitor's preferred browser language
 * wins (India → Hindi or English; Switzerland/Belgium/Canada etc.). If the
 * browser language is not supported, the country's primary language is used.
 */
export const MULTILANG_COUNTRY_PRIMARY: Record<string, string> = {
  IN: "hi",
  CH: "de",
  BE: "fr",
  SG: "en",
  PH: "en",
  MY: "en",
};

/** Language tags (from Accept-Language / navigator.languages) → our locale code. */
const LANG_ALIASES: Record<string, string> = {
  en: "en", "en-us": "en", "en-gb": "en", "en-au": "en", "en-ca": "en", "en-nz": "en", "en-ie": "en",
  "en-in": "en", "en-ng": "en", "en-za": "en", "en-ke": "en", "en-tz": "en", "en-gh": "en",
  "en-ph": "en", "en-sg": "en", "en-my": "en", "en-pk": "en", "en-bd": "en", "en-lk": "en",
  "en-hk": "en", "en-np": "en",
  zh: "zh-Hans", "zh-cn": "zh-Hans", "zh-hans": "zh-Hans", "zh-sg": "zh-Hans", "zh-tw": "zh-Hans",
  "zh-hk": "zh-Hans", "zh-mo": "zh-Hans",
  es: "es", "es-es": "es", "es-mx": "es", "es-ar": "es", "es-co": "es", "es-cl": "es", "es-pe": "es",
  "es-ve": "es", "es-ec": "es", "es-uy": "es", "es-py": "es", "es-bo": "es", "es-gt": "es",
  "es-cu": "es", "es-do": "es", "es-hn": "es", "es-sv": "es", "es-ni": "es", "es-cr": "es",
  "es-pa": "es", "es-pr": "es",
  fr: "fr", "fr-fr": "fr", "fr-ca": "fr", "fr-be": "fr", "fr-ch": "fr", "fr-mc": "fr", "fr-sn": "fr",
  "fr-ci": "fr", "fr-ma": "fr", "fr-dz": "fr",
  de: "de", "de-de": "de", "de-at": "de", "de-ch": "de",
  pt: "pt", "pt-br": "pt", "pt-pt": "pt", "pt-ao": "pt", "pt-mz": "pt",
  ar: "ar", "ar-sa": "ar", "ar-ae": "ar", "ar-eg": "ar", "ar-iq": "ar", "ar-jo": "ar", "ar-kw": "ar",
  "ar-lb": "ar", "ar-ly": "ar", "ar-ma": "ar", "ar-om": "ar", "ar-qa": "ar", "ar-sd": "ar",
  "ar-sy": "ar", "ar-ye": "ar", "ar-ps": "ar", "ar-bh": "ar", "ar-mr": "ar", "ar-dz": "ar",
  "ar-tn": "ar",
  hi: "hi", "hi-in": "hi",
  ja: "ja", "ja-jp": "ja",
  ko: "ko", "ko-kr": "ko",
  it: "it", "it-it": "it", "it-ch": "it",
  ru: "ru", "ru-ru": "ru", "ru-ua": "ru",
  tr: "tr", "tr-tr": "tr",
  nl: "nl", "nl-nl": "nl", "nl-be": "nl",
  id: "id", "id-id": "id",
  vi: "vi", "vi-vn": "vi",
  th: "th", "th-th": "th",
  pl: "pl", "pl-pl": "pl",
  uk: "uk", "uk-ua": "uk",
  sw: "sw", "sw-ke": "sw", "sw-tz": "sw", "sw-ug": "sw",
  yo: "yo", "yo-ng": "yo",
  ig: "ig", "ig-ng": "ig",
};

/** Normalize any BCP-47 tag to a supported locale code (or null). */
export function normalizeLangTag(tag: string): string | null {
  const t = tag.trim().toLowerCase();
  if (LANG_ALIASES[t]) return LANG_ALIASES[t];
  const base = t.split("-")[0];
  return LANG_ALIASES[base] ?? null;
}

/** Parse an Accept-Language header into an ordered, de-duplicated list. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  const out: string[] = [];
  for (const part of header.split(",")) {
    const tag = part.trim().split(";")[0];
    if (!tag) continue;
    const code = normalizeLangTag(tag);
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

/** Normalizes an array of raw language tags (navigator.languages). */
export function normalizeBrowserLanguages(tags: readonly string[] | undefined): string[] {
  if (!tags || tags.length === 0) return [];
  const out: string[] = [];
  for (const tag of tags) {
    const code = normalizeLangTag(tag);
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

/**
 * Resolves the most appropriate language for a visitor.
 *
 * Precedence:
 * 1. The visitor's saved choice (localStorage) always wins.
 * 2. English-speaking country → English (#2).
 * 3. Strong single-language country (e.g. China → Simplified Chinese) → that
 *    language (#3, #4).
 * 4. Multi-language country → the visitor's browser language when supported,
 *    else the country's primary language (India → Hindi or English).
 * 5. No country signal → the visitor's first supported browser language.
 * 6. Anything unsupported → English (#11).
 */
export function resolveInitialLocale(
  saved: string | null,
  serverCountry: string | null,
  browserLangs: string[]
): LocaleCode {
  if (saved && isSupportedLocale(saved)) return saved;

  const browserMatch = browserLangs.find(isSupportedLocale) ?? null;
  const cc = (serverCountry || "").toUpperCase();

  if (cc) {
    if (ENGLISH_COUNTRY_CODES.has(cc)) return "en";
    const countryLocale = COUNTRY_TO_LOCALE[cc];
    if (countryLocale) {
      const isMultiLang = cc in MULTILANG_COUNTRY_PRIMARY;
      if (isMultiLang) return (browserMatch as LocaleCode) ?? (MULTILANG_COUNTRY_PRIMARY[cc] as LocaleCode) ?? DEFAULT_LOCALE;
      return countryLocale as LocaleCode;
    }
    const multiPrimary = MULTILANG_COUNTRY_PRIMARY[cc];
    if (multiPrimary) return (browserMatch as LocaleCode) ?? (multiPrimary as LocaleCode) ?? DEFAULT_LOCALE;
  }

  return (browserMatch as LocaleCode) ?? DEFAULT_LOCALE;
}

/** True when the country signal should be treated as authoritative. */
export function isCountryAuthoritative(country: string | null): boolean {
  const cc = (country || "").toUpperCase();
  if (!cc) return false;
  if (ENGLISH_COUNTRY_CODES.has(cc)) return true;
  if (COUNTRY_TO_LOCALE[cc]) return !(cc in MULTILANG_COUNTRY_PRIMARY);
  return false;
}