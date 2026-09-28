import type { Dict } from "./en";
import type { DeepPartial } from "../types";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { ar } from "./ar";
import { hi } from "./hi";
import { zhHans } from "./zh-Hans";
import { coreDictionaries } from "./core";

/**
 * Every supported locale mapped to its dictionary. Keys missing from a
 * translated dictionary automatically fall back to English at lookup time
 * (see language-context). This map is the single source of truth, shared by
 * the runtime provider and the dev-time `i18n:check` script so they always
 * agree on which dictionary backs each locale.
 */
export const DICTIONARIES: Record<string, DeepPartial<Dict>> = {
  en,
  es,
  fr,
  ar,
  hi,
  "zh-Hans": zhHans,
  "zh-Hant": coreDictionaries["zh-Hant"],
  de: coreDictionaries.de,
  pt: coreDictionaries.pt,
  ja: coreDictionaries.ja,
  ko: coreDictionaries.ko,
  it: coreDictionaries.it,
  ru: coreDictionaries.ru,
  tr: coreDictionaries.tr,
  nl: coreDictionaries.nl,
  id: coreDictionaries.id,
  ms: coreDictionaries.ms,
  vi: coreDictionaries.vi,
  th: coreDictionaries.th,
  pl: coreDictionaries.pl,
  uk: coreDictionaries.uk,
  sw: coreDictionaries.sw,
  he: coreDictionaries.he,
  bn: coreDictionaries.bn,
  ur: coreDictionaries.ur,
};