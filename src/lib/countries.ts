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
  "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger",
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