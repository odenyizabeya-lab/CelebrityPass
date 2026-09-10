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