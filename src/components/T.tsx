"use client";

import { useLanguage, type TranslateVars } from "@/lib/i18n/language-context";

/**
 * Client component that renders a translated string by dot-path. Safe to use
 * inside Server Components because only this little element ships to the
 * client. Falls back to English, then the key itself.
 */
export default function T({
  k,
  vars,
}: {
  k: string;
  vars?: TranslateVars;
}) {
  const { t } = useLanguage();
  return <>{t(k, vars)}</>;
}