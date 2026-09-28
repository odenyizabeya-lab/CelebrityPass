/**
 * Dev-time i18n coverage checker.
 *
 * Compares every translated dictionary against the English source of truth
 * (en.ts) and prints per-locale coverage. Exits non-zero when a supported
 * locale has NO dictionary at all (a structural error: that locale would
 * render 100% English). Missing keys in translated dictionaries are expected
 * — they fall back to English at lookup time by design — but unknown extra
 * keys (not present in English) are flagged since they are likely typos or
 * stale leftovers.
 *
 * Run with: npm run i18n:check
 */
import { DICTIONARIES } from "../../src/lib/i18n/dictionaries";
import { en } from "../../src/lib/i18n/dictionaries/en";
import { LOCALES } from "../../src/lib/i18n/locales";

type Obj = Record<string, unknown>;

function flattenKeys(obj: unknown, prefix = ""): string[] {
  const out: string[] = [];
  if (obj == null) return out;
  if (typeof obj === "string") {
    if (prefix) out.push(prefix);
    return out;
  }
  if (typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj as Obj)) {
    out.push(...flattenKeys(v, prefix ? `${prefix}.${k}` : k));
  }
  return out;
}

const sourceKeys = flattenKeys(en);
const sourceSet = new Set(sourceKeys);
const total = sourceKeys.length;
let fatal = false;

console.log(`i18n coverage vs en.ts (${total} source keys, ${LOCALES.length} locales):\n`);

for (const loc of LOCALES) {
  const dict = DICTIONARIES[loc.code];
  if (!dict) {
    console.error(`  ✖ ${loc.code}: NO DICTIONARY — every string renders English`);
    fatal = true;
    continue;
  }
  const keys = flattenKeys(dict);
  const present = new Set(keys);
  const missing = sourceKeys.filter((k) => !present.has(k)).length;
  const extra = keys.filter((k) => !sourceSet.has(k));
  const covered = total - missing;
  const pct = total === 0 ? 0 : Math.round((covered / total) * 100);
  const bar = "#".repeat(Math.max(0, Math.min(20, Math.floor(pct / 5))));
  console.log(
    `  ${loc.code.padEnd(9)} ${String(pct).padStart(3)}%  ${bar.padEnd(20)}  ` +
      `${missing} missing / ${extra.length} extra`,
  );
  if (extra.length > 0) {
    console.warn(`      ⚠ unknown key(s) not present in English: ${extra.slice(0, 6).join(", ")}${extra.length > 6 ? ", …" : ""}`);
  }
}

if (fatal) {
  console.error("\nFatal: at least one supported locale has no dictionary.");
  process.exit(1);
}
console.log("\nOK — every supported locale has a dictionary. Missing keys fall back to English at lookup time.");