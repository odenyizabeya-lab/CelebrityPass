/**
 * Auth-policy regression check.
 *
 * `src/lib/routes.ts` and `src/lib/session-token.ts` are the two pieces of
 * security-critical logic in the app: they decide whether a request is allowed
 * to see a personalised page, and whether a session cookie is authentic. Neither
 * is easy to eyeball, and a mistake in either is a silent security regression
 * rather than a crash, so they are covered here.
 *
 * Run with: npm run check:auth
 *
 * This found a real bug: `safeEqual` compared hex digests after
 * `Buffer.from(value, "hex")`, which silently ignores trailing non-hex
 * characters — so a session token with any junk appended to its signature
 * verified successfully.
 */
import {
  classifyRoute, sanitizeNext, isPersonalised, isApiPath,
  POST_AUTH_DEFAULT, POST_LOGIN_DEFAULT,
} from "../src/lib/routes.ts";
import { signSessionToken, verifySessionToken, SESSION_TTL_MS } from "../src/lib/session-token.ts";
import { SELECTABLE_COUNTRIES, isSelectableCountry, normalizeCountry } from "../src/lib/countries.ts";

let fails = 0;
const ok = (name: string, got: unknown, want: unknown) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) { fails++; console.log(`FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); }
  else console.log(`PASS  ${name}`);
};

console.log("--- classifyRoute: web, anonymous ---");
ok("/            -> entry", classifyRoute("/"), "entry");
ok("/dashboard   -> protected", classifyRoute("/dashboard"), "protected");
ok("/dashboard/x -> protected", classifyRoute("/dashboard/fans"), "protected");
ok("/onboarding/celebrities", classifyRoute("/onboarding/celebrities"), "protected");
ok("/api/x       -> public", classifyRoute("/api/x"), "public");
ok("/celebrities -> public (SEO)", classifyRoute("/celebrities"), "public");
ok("/celebrity/a -> public (SEO)", classifyRoute("/celebrity/a"), "public");
ok("/legal/privacy", classifyRoute("/legal/privacy"), "public");
ok("/login", classifyRoute("/login"), "public");
ok("/register", classifyRoute("/register"), "public");
ok("/admin/marketing NOT fan-gated (Supabase owns it)", classifyRoute("/admin/marketing"), "public");
ok("/invest      -> public", classifyRoute("/invest"), "public");
ok("/invest/markets -> public (editorial)", classifyRoute("/invest/markets"), "public");
ok("/invest/news    -> public (editorial)", classifyRoute("/invest/news"), "public");
ok("/invest/portfolio -> protected", classifyRoute("/invest/portfolio"), "protected");
ok("/invest/deposit   -> protected", classifyRoute("/invest/deposit"), "protected");
ok("/invest/deposit/flutterwave", classifyRoute("/invest/deposit/flutterwave"), "protected");
ok("unknown route fails closed", classifyRoute("/brand-new-thing"), "protected");
ok("/robots.txt asset", classifyRoute("/robots.txt"), "public");
ok("/icon.svg asset", classifyRoute("/icon.svg"), "public");

console.log("--- classifyRoute: native, anonymous (app is closed) ---");
ok("/            -> entry", classifyRoute("/", true), "entry");
ok("/dashboard   -> protected", classifyRoute("/dashboard", true), "protected");
ok("/celebrities -> protected in app", classifyRoute("/celebrities", true), "protected");
ok("/celebrity/a -> protected in app", classifyRoute("/celebrity/a", true), "protected");
ok("/legal/privacy stays public", classifyRoute("/legal/privacy", true), "public");
ok("/about stays public (deep links)", classifyRoute("/about", true), "public");
ok("/api/x       -> public", classifyRoute("/api/x", true), "public");
ok("/login       -> public", classifyRoute("/login", true), "public");

console.log("--- sanitizeNext (open-redirect guard) ---");
ok("relative", sanitizeNext("/dashboard"), "/dashboard");
ok("nested+query", sanitizeNext("/celebrity/abc?x=1"), "/celebrity/abc?x=1");
ok("protocol-relative //evil", sanitizeNext("//evil.com"), null);
ok("absolute https", sanitizeNext("https://evil.com"), null);
ok("backslashes", sanitizeNext("/a\\b"), null);
ok("leading backslash host", sanitizeNext("/\\evil.com"), null);
ok("CRLF header split", sanitizeNext("/a\r\nSet-Cookie: x"), null);
ok("tab", sanitizeNext("/a\tb"), null);
ok("javascript:", sanitizeNext("javascript:alert(1)"), null);
ok("empty", sanitizeNext(""), null);
ok("undefined", sanitizeNext(undefined), null);
ok("not starting with slash", sanitizeNext("dashboard"), null);
ok("defaults", [POST_AUTH_DEFAULT, POST_LOGIN_DEFAULT], ["/onboarding/celebrities", "/dashboard"]);

console.log("--- session token: happy path ---");
const t = signSessionToken("fan_abc123");
ok("4 parts, v2", [t.split(".").length, t.split(".")[0]], [4, "v2"]);
ok("round-trips to fanId", verifySessionToken(t), "fan_abc123");
ok("ttl sane (1h..90d)", SESSION_TTL_MS >= 3600e3 && SESSION_TTL_MS <= 90 * 864e5, true);

console.log("--- session token: expiry ---");
ok("expired rejected", verifySessionToken(signSessionToken("fan_x", -1000)), null);
ok("just-alive accepted", verifySessionToken(signSessionToken("fan_x", 5000)) !== null, true);

console.log("--- session token: forgery / corruption ---");
const p = t.split(".");
ok("empty rejected", verifySessionToken(""), null);
ok("random string rejected", verifySessionToken("nonsense"), null);
ok("wrong arity rejected", verifySessionToken("v2.a.b"), null);
ok("swapped fanId rejected", verifySessionToken(`v2.fan_EVIL.${p[2]}.${p[3]}`), null);
ok("bumped expiry rejected", verifySessionToken(`v2.${p[1]}.${Number(p[2]) + 1}.${p[3]}`), null);
ok("version downgrade to v1 rejected", verifySessionToken(`${p[1]}.${p[3]}`), null);
ok("empty fanId rejected", verifySessionToken(`v2..${p[2]}.${p[3]}`), null);
ok("NaN expiry rejected", verifySessionToken(`v2.${p[1]}.NaN.${p[3]}`), null);
// Regression: Buffer.from(x, "hex") ignores trailing non-hex junk.
ok("garbage appended to sig rejected", verifySessionToken(`${p[0]}.${p[1]}.${p[2]}.${p[3]}x`), null);
ok("garbage prepended to sig rejected", verifySessionToken(`${p[0]}.${p[1]}.${p[2]}.x${p[3]}`), null);
ok("truncated sig rejected", verifySessionToken(`${p[0]}.${p[1]}.${p[2]}.${p[3].slice(0, 60)}`), null);
ok("empty sig rejected", verifySessionToken(`${p[0]}.${p[1]}.${p[2]}.`), null);
ok("non-hex sig rejected", verifySessionToken(`${p[0]}.${p[1]}.${p[2]}.${"z".repeat(64)}`), null);
ok("legacy v1 forged rejected", verifySessionToken("fan_abc.deadbeef"), null);
ok("null/undefined rejected", [verifySessionToken(null), verifySessionToken(undefined)], [null, null]);

console.log("--- helpers ---");
ok("isApiPath", [isApiPath("/api"), isApiPath("/api/x"), isApiPath("/apix")], [true, true, false]);
ok("isPersonalised protected=yes, SEO=no", [isPersonalised("/dashboard"), isPersonalised("/celebrities")], [true, false]);

console.log("--- country list integrity ---");
// The registration API rejects any country outside this list, so the list is a
// deliberate allow-list of markets the platform serves, not an exhaustive index
// of world countries. Nigeria and Ghana are intentionally excluded — do not add
// them. What this check protects against is corruption (duplicates, broken
// ordering, an entry that fails its own validation) and against an entry
// silently disappearing from an allow-list.
{
  const list = SELECTABLE_COUNTRIES;
  ok("no duplicates", list.length, new Set(list).size);
  const sorted = [...list].sort((a, b) => a.localeCompare(b, "en"));
  ok("alphabetically ordered", list.join("|"), sorted.join("|"));
  const missing = [
    "United States", "United Kingdom", "India", "Brazil", "Mexico", "Germany",
    "France", "Japan", "China", "Philippines", "Egypt", "Morocco", "Australia",
    "Canada", "Kenya", "South Africa", "Turkey",
  ].filter((c) => !list.includes(c));
  ok("spot-check served markets all present", missing, []);
  // Every entry must survive the same validation the API applies.
  const notSelectable = list.filter((c) => !isSelectableCountry(c));
  ok("every entry passes isSelectableCountry", notSelectable, []);
  const aliasChecks: [string, string][] = [
    ["usa", "United States"], ["UK", "United Kingdom"], ["UAE", "United Arab Emirates"],
    ["czechia", "Czech Republic"], ["holland", "Netherlands"],
  ];
  for (const [input, want] of aliasChecks) {
    ok(`alias "${input}" -> ${want}`, normalizeCountry(input), want);
    ok(`alias "${input}" is selectable`, isSelectableCountry(input), true);
  }
  ok("free text rejected", isSelectableCountry("Atlantis"), false);
  ok("unserved market rejected", isSelectableCountry("Nigeria"), false);
ok("unserved market rejected", isSelectableCountry("Ghana"), false);
  ok("blank rejected", isSelectableCountry("   "), false);
  ok("null rejected", isSelectableCountry(null), false);
}

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);

