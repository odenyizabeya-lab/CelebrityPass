/**
 * The countries the platform represents. DB-derived names are normalized and
 * merged into this base list, so the total can never drop below BASE_COUNTRIES
 * and automatically grows the moment a new celebrity (or fan) from an
 * unrepresented country is added.
 */

export const BASE_COUNTRIES: string[] = [
  "Algeria",
  "Argentina",
  "Australia",
  "Austria",
  "Bangladesh",
  "Belgium",
  "Brazil",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Cuba",
  "Czech Republic",
  "Denmark",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "Ethiopia",
  "Finland",
  "France",
  "Germany",
  "Ghana",
  "Greece",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kuwait",
  "Lebanon",
  "Malaysia",
  "Mexico",
  "Morocco",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Oman",
  "Pakistan",
  "Panama",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "Singapore",
  "Slovakia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Tanzania",
  "Thailand",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Venezuela",
  "Vietnam",
  "Zambia",
  "Zimbabwe",
];

/**
 * The full list of countries shown in signup/payment country dropdowns so
 * fans anywhere in the world can find their country (Nigeria and Ghana are
 * deliberately excluded from an issuable card). Alphabetical.
 */
export const SELECTABLE_COUNTRIES: string[] = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia",
  "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad",
  "Chile", "China", "Colombia", "Comoros", "Congo (Democratic Republic)", "Congo (Republic)", "Costa Rica",
  "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji",
  "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati",
  "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein",
  "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands",
  "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco",
  "Mozambique", "Myanmar",   "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger",
  "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama",
  "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia",
  "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
  "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain",
  "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania",
  "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
  "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay",
  "Uzbekistan", "Vanuatu", "Vatican", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

const COUNTRY_ALIASES: Record<string, string> = {
  "usa": "United States",
  "u.s.a": "United States",
  "us": "United States",
  "america": "United States",
  "united states of america": "United States",
  "uk": "United Kingdom",
  "u.k": "United Kingdom",
  "england": "United Kingdom",
  "scotland": "United Kingdom",
  "wales": "United Kingdom",
  "great britain": "United Kingdom",
  "britain": "United Kingdom",
  "uae": "United Arab Emirates",
  "dubai": "United Arab Emirates",
  "abu dhabi": "United Arab Emirates",
  "korea": "South Korea",
  "republic of korea": "South Korea",
  "the netherlands": "Netherlands",
  "holland": "Netherlands",
  "czechia": "Czech Republic",
  "switzerland (confederation)": "Switzerland",
  "russian federation": "Russia",
  "tanzania, united republic of": "Tanzania",
};

/** Normalizes a country name so "USA", "America", "England" etc. resolve to one canonical name. */
export function normalizeCountry(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = name.trim().replace(/\s+/g, " ").toLowerCase();
  if (!key) return null;
  return COUNTRY_ALIASES[key] ?? name.trim().replace(/\s+/g, " ");
}

/** True when `name` is a country the platform accepts from a user. */
export function isSelectableCountry(name: string | null | undefined): boolean {
  const canonical = normalizeCountry(name);
  if (!canonical) return false;
  return SELECTABLE_COUNTRIES.includes(canonical);
}

/** One row in the country picker. */
export interface CountryOption {
  /** Canonical English name — this is what gets stored on the fan record. */
  value: string;
  /** Name to display, localised to the viewer's language when possible. */
  label: string;
  /** ISO 3166-1 alpha-2 code when it could be resolved, otherwise an empty string. */
  code: string;
  /** Lower-cased haystack for search (canonical + localised + code). */
  search: string;
}

/** Regional-indicator flag emoji for an ISO alpha-2 code, or "" when unknown. */
function flagFor(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  const base = 0x1f1e6;
  const up = code.toUpperCase().charCodeAt(0) - 65;
  return String.fromCodePoint(base + up, base + (code.toUpperCase().charCodeAt(1) - 65));
}

const optionCache = new Map<string, CountryOption[]>();

/**
 * The country list for the picker, localised to `locale`.
 *
 * Built from `Intl.DisplayNames` + `Intl.supportedValuesOf` so the country
 * names are translated for free in every supported language and the stored
 * value stays the canonical English name the rest of the platform uses — no
 * hand-maintained ISO table, and nothing to drift.
 *
 * Both Intl APIs are feature-detected: on an old WebView (or a server without
 * full ICU) this falls back to the canonical English list, which is still a
 * correct, selectable, searchable list.
 */
export function countryOptions(locale?: string): CountryOption[] {
  const tag = (locale || "en").trim() || "en";
  const cached = optionCache.get(tag);
  if (cached) return cached;

  const options = buildCountryOptions(tag);
  optionCache.set(tag, options);
  return options;
}

function buildCountryOptions(locale: string): CountryOption[] {
  const canonicalSet = new Set(SELECTABLE_COUNTRIES);
  const out: CountryOption[] = [];
  const seen = new Set<string>();

  const supportsIntl =
    typeof Intl !== "undefined" &&
    typeof (Intl as { DisplayNames?: unknown }).DisplayNames === "function" &&
    typeof (Intl as { supportedValuesOf?: unknown }).supportedValuesOf === "function";

  if (supportsIntl) {
    try {
      const display = new (Intl as unknown as {
        DisplayNames: new (
          locales: string[],
          opts: { type: string },
        ) => { of: (code: string) => string | undefined };
      }).DisplayNames([locale, "en"], { type: "region" });
      const english = new (Intl as unknown as {
        DisplayNames: new (
          locales: string[],
          opts: { type: string },
        ) => { of: (code: string) => string | undefined };
      }).DisplayNames(["en"], { type: "region" });

      for (const code of (Intl as unknown as { supportedValuesOf: (k: string) => string[] })
        .supportedValuesOf("region")) {
        const canonical = english.of(code);
        if (!canonical || !canonicalSet.has(canonical) || seen.has(canonical)) continue;
        seen.add(canonical);
        const localised = display.of(code) ?? canonical;
        out.push({
          value: canonical,
          label: localised,
          code: code.toUpperCase(),
          search: `${canonical} ${localised} ${code}`.toLowerCase(),
        });
      }
    } catch {
      // fall through to the English-only list
    }
  }

  if (out.length === 0) {
    for (const canonical of SELECTABLE_COUNTRIES) {
      out.push({ value: canonical, label: canonical, code: "", search: canonical.toLowerCase() });
    }
  }

  // Alphabetical by what the user actually reads.
  out.sort((a, b) => a.label.localeCompare(b.label, locale));
  return out;
}

/** Filter helper shared by the picker so search behaviour stays consistent. */
export function searchCountryOptions(options: readonly CountryOption[], query: string): CountryOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options.slice();
  const starts: CountryOption[] = [];
  const contains: CountryOption[] = [];
  for (const option of options) {
    if (option.label.toLowerCase().startsWith(q)) starts.push(option);
    else if (option.search.includes(q)) contains.push(option);
  }
  return starts.concat(contains);
}

/** The letter buckets shown in the country picker index. */
export function countryIndexLetters(options: readonly CountryOption[]): string[] {
  const letters = new Set<string>();
  for (const option of options) {
    const first = option.label.trim().charAt(0).toUpperCase();
    if (first && /[A-Z]/.test(first)) letters.add(first);
  }
  return [...letters].sort();
}

export { flagFor as countryFlagEmoji };

/**
 * The full list of countries the platform represents: the curated base list,
 * then any additional countries found in the data (celebrity + fan countries).
 * Never shrinks below the base.
 */
export function representedCountryList(countryNames: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const name of BASE_COUNTRIES) {
    const canonical = normalizeCountry(name);
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      ordered.push(canonical);
    }
  }

  for (const name of countryNames) {
    const canonical = normalizeCountry(name);
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      ordered.push(canonical);
    }
  }

  return ordered;
}