// Minimal, dependency-free Gemini REST client + call builders for the
// Automatic Celebrity Scanner (v2 — rebuilt 2026-09).
//
// Differences from the old client that make it resilient:
//   1. NEVER trusts a single stored model. If the configured model is retired,
//      renamed, or unavailable for this key (HTTP 404 NOT_FOUND), the pipeline
//      automatically moves to the next model in the current catalog instead of
//      failing the whole scan.
//   2. Transient failures (network / server / timeout) are retried with backoff
//      before the scanner falls through to another credential.
//   3. Key-level blocks (invalid key, quota, billing, suspended/restricted,
//      disabled service) are treated as "skip this key, try the next" so one
//      broken key can never take the scanner down.
//   4. All credential/model hiking lives in the caller (scanner.ts) — this
//      module is pure: same input, same REST behavior, no app imports.
//
// The JSON contract matches what the admin celebrity form consumes.

export type GeminiCredential = { key: string; model: string; label: string };

export type AiErrorType =
  | "invalid_key"
  | "quota"
  | "timeout"
  | "model"
  | "billing"
  | "permission"
  | "api_disabled"
  | "project_restriction"
  | "unsupported_combination"
  | "server"
  | "network";

export class AiCallError extends Error {
  type: AiErrorType;
  status?: number;
  constructor(type: AiErrorType, message: string, status?: number) {
    super(message);
    this.name = "AiCallError";
    this.type = type;
    this.status = status;
  }
}

/** Turn any error into a safe, user-facing message (never contains a key). */
export function friendlyAiError(e: unknown): { message: string; detail?: string } {
  if (e instanceof AiCallError) {
    switch (e.type) {
      case "invalid_key":
        return { message: "The Gemini API key was rejected. Check the key in Admin → AI Settings." };
      case "api_disabled":
        return {
          message: "The Generative Language (Gemini) API is not enabled for this key's Google Cloud project.",
          detail: "Enable it in Google Cloud console, or add a working GEMINI_API_KEY.",
        };
      case "billing":
        return {
          message: "The Gemini key is valid, but this model requires billing on the Google project.",
          detail: "Link a billing account in Google Cloud console. A valid key without billing can often use gemini-3.6-flash.",
        };
      case "project_restriction":
        return {
          message: "The Gemini key is valid but restricted — its API/IP/referrer allow-list blocked this request.",
          detail: "Remove the key's application/IP restrictions in Google AI Studio or Cloud.",
        };
      case "quota":
        return {
          message: "The Gemini API has reached its quota/rate limit right now.",
          detail:
            "Wait a minute and retry. If this keeps happening every scan, the key's monthly search/billing quota is used up — enable billing in Google Cloud for this key's project, or add a fresh key in Admin → AI Settings (the current backup key is suspended).",
        };
      case "model":
        return { message: "The configured Gemini model is unavailable. The scanner is retrying a current model automatically." };
      case "permission":
        return { message: "The Gemini API denied this request (key suspended or project locked)." };
      case "timeout":
        return { message: "Gemini took too long to respond. Try again in a moment." };
      case "network":
        return { message: "Could not reach the Gemini API (network error). Try again in a moment." };
      case "unsupported_combination":
        return { message: "The model does not support search grounding with structured JSON output on this request." };
      default:
        return { message: `Gemini request failed: ${e.message}` };
    }
  }
  return { message: `Gemini request failed: ${e instanceof Error ? e.message : String(e)}` };
}

type GeminiErrorBody = { status: string; reason: string; message: string };

/** Parse the Gemini REST error payload (never contains the API key). */
export function parseGeminiError(text: string): GeminiErrorBody {
  try {
    const j = JSON.parse(text);
    const e = j?.error;
    if (e && typeof e === "object") {
      const reason = Array.isArray(e.details) && typeof e.details[0]?.reason === "string" ? e.details[0].reason : "";
      return { status: String(e.status ?? "").toUpperCase(), reason, message: String(e.message ?? "") };
    }
  } catch {
    /* non-JSON body below */
  }
  return { status: "", reason: "", message: text };
}

/**
 * Map an HTTP/body error to an AiErrorType so the scanner knows whether to
 * retry, skip the credential, or surface a friendly message.
 */
export function classifyError(status: number, text: string, hadSearchTool: boolean): AiErrorType {
  const body = parseGeminiError(text);
  const t = body.message.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (status === 401) return "invalid_key";

  if (status === 429 || body.status === "RESOURCE_EXHAUSTED") return "quota";

  if (status === 404 || body.status === "NOT_FOUND") return "model";

  if (status === 400) {
    if (body.reason === "API_KEY_INVALID" || has("api key not valid", "key is not valid", "invalid api key", "unauthenticated")) return "invalid_key";
    if (body.reason === "PROJECT_INVALID" || body.reason === "USER_PROJECT_INVALID" || has("project not found", "project id")) return "project_restriction";
    if (has("referrer", "ip address", "api key internal", "restriction")) return "project_restriction";
    if (has("model")) return "model";
    if (hadSearchTool && /(search|grounding|schema|mime type|mimetype|not supported|combination|cannot use)/.test(t)) return "unsupported_combination";
    if (has("not enabled", "disabled", "enable")) return "api_disabled";
    return "model";
  }

  if (status === 403) {
    if (body.reason === "SERVICE_DISABLED") return "api_disabled";
    if (body.reason === "CONSUMER_INVALID") return "project_restriction";
    if (body.reason === "API_KEY_INVALID") return "invalid_key";
    if (body.status === "FAILED_PRECONDITION" || has("billing", "paid", "upgrade", "pricing", "payment", "plan")) return "billing";
    if (body.reason === "CONSUMER_SUSPENDED" || has("suspended")) return "permission";
    if (has("quota", "rate", "limit", "exhausted")) return "quota";
    if (has("not enabled", "disabled", "enable the", "enable it", "enable this", "api key that cannot", "api is not")) return "api_disabled";
    if (has("restricted", "restriction", "ip addresses", "referrer", "android package", "permitted", "allowlisted")) return "project_restriction";
    if (has("not authorized", "not have permission", "does not have permission", "unauthorized", "access denied")) return "permission";
    if (has("model") && has("not available", "not found", "not supported", "not exist")) return "model";
    if (has("api key not valid", "invalid api key")) return "invalid_key";
    return "permission";
  }

  return "server";
}

/** Current, live model candidates. First entry is the preferred new default. */
export const CURRENT_MODEL_CATALOG = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
] as const;

/**
 * Ordered (model × key) credential chain for a scan. The preferred model is
 * tried first across every available key, then the next model, and so on — so
 * a retired model on a working key, or a broken key, degrades gracefully
 * instead of failing the scan.
 */
export function buildCredentialChain(
  sources: { key: string; label: string }[],
  preferredModel: string,
): GeminiCredential[] {
  const models = [preferredModel, ...CURRENT_MODEL_CATALOG].filter(
    (m, i, arr) => !!m && arr.indexOf(m) === i,
  );
  const keys = sources
    .map((s) => ({ key: s.key.trim(), label: s.label }))
    .filter((s) => s.key);
  const seen = new Set<string>();
  const out: GeminiCredential[] = [];
  for (const model of models) {
    for (const k of keys) {
      const id = `${k.key}|${model}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ key: k.key, model, label: k.label });
    }
  }
  return out;
}

function parseDataUri(dataUri: string): { mimeType: string; data: string } {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri.trim());
  if (!m) throw new AiCallError("server", "Invalid image data URI. Upload a clear photo and try again.");
  const bytes = Math.ceil((m[2].length * 3) / 4);
  if (bytes > 12 * 1024 * 1024) throw new AiCallError("server", "Image is too large for scanning (keep it under 12 MB).");
  return { mimeType: m[1], data: m[2] };
}

type CallOptions = {
  credential: GeminiCredential;
  system: string;
  userText: string;
  imageDataUri?: string | null;
  schema: Record<string, unknown>;
  useSearch?: boolean;
  temperature?: number;
  timeoutMs?: number;
};

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** One Gemini generateContent call (no retries) returning the parsed JSON payload. */
export async function geminiJson<T>(opts: CallOptions): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 55_000;
  // Key travels in the X-Goog-Api-Key header — never in the URL, so it can't
  // leak into request logs, proxy history, or query-string dumps.
  const url = `${API_BASE}/${encodeURIComponent(opts.credential.model)}:generateContent`;

  const parts: Array<Record<string, unknown>> = [];
  const img = opts.imageDataUri ? parseDataUri(opts.imageDataUri) : null;
  if (img) parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
  parts.push({ text: opts.userText });

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    systemInstruction: { parts: [{ text: opts.system }] },
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      responseMimeType: "application/json",
      responseSchema: opts.schema,
      maxOutputTokens: 8192,
    },
  };
  if (opts.useSearch) body.tools = [{ googleSearch: {} }];

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": opts.credential.key,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new AiCallError("timeout", `Gemini request timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw new AiCallError("network", "Could not reach the Gemini API (network error).");
  }

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new AiCallError(classifyError(res.status, text, Boolean(opts.useSearch)), `Gemini HTTP ${res.status}: ${text.slice(0, 300)}`, res.status);
  }

  let parsed: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiCallError("server", "Gemini returned an unreadable response.");
  }

  const candidateText = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!candidateText.trim()) throw new AiCallError("server", "Gemini returned an empty response (try again).");

  try {
    return JSON.parse(candidateText) as T;
  } catch {
    throw new AiCallError("server", "Gemini returned invalid JSON.");
  }
}

// ---------------------------------------------------------------------------
// Schemas (Gemini OpenAPI-style responseSchema) — contract with the admin form
// ---------------------------------------------------------------------------
const STRING = { type: "STRING" as const };
const BOOLEAN = { type: "BOOLEAN" as const };
const STRING_NULL = { type: "STRING", nullable: true };
const NUMBER_NULL = { type: "NUMBER", nullable: true };

const IDENTIFY_SCHEMA = {
  type: "OBJECT",
  properties: {
    identified: BOOLEAN,
    best_name: STRING_NULL,
    names: { type: "ARRAY", items: STRING },
    confidence: { type: "STRING", enum: ["high", "low"] },
    reason: STRING_NULL,
  },
  required: ["identified", "best_name", "names", "confidence", "reason"],
};

const PROFILE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: STRING,
    aliases: { type: "ARRAY", items: STRING },
    category: STRING,
    profession: STRING,
    country: STRING,
    city: STRING_NULL,
    website: STRING_NULL,
    accent_color: STRING,
    followers: {
      type: "OBJECT",
      properties: { instagram: NUMBER_NULL, tiktok: NUMBER_NULL, facebook: NUMBER_NULL },
    },
    socials: {
      type: "OBJECT",
      properties: {
        facebook: STRING_NULL,
        instagram: STRING_NULL,
        tiktok: STRING_NULL,
        google: STRING_NULL,
      },
    },
    card_design: {
      type: "OBJECT",
      properties: { badge_text: STRING_NULL, watermark: STRING_NULL, accent: STRING_NULL },
    },
    base_memberships: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: STRING, description: STRING, price: NUMBER_NULL, currency: STRING },
      },
    },
    source_urls: { type: "ARRAY", items: STRING },
  },
  required: [
    "name",
    "category",
    "profession",
    "country",
    "accent_color",
    "followers",
    "socials",
    "card_design",
    "base_memberships",
    "source_urls",
  ],
};

const EVENTS_SCHEMA = {
  type: "OBJECT",
  properties: {
    events: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: STRING,
          type: STRING,
          description: STRING_NULL,
          venue: STRING_NULL,
          city: STRING_NULL,
          country: STRING_NULL,
          start_date: STRING,
          start_time: STRING_NULL,
          timezone: STRING_NULL,
          official_url: STRING_NULL,
          source_url: STRING_NULL,
        },
      },
    },
  },
  required: ["events"],
};

// ---------------------------------------------------------------------------
// Prompt builders + call functions
// ---------------------------------------------------------------------------
const IDENTIFY_SYSTEM = `You are the identity verifier for a celebrity fan-card platform.
Your ONLY job is to decide whether a photo clearly shows a single well-known public figure, and who they are.
Rules:
- If the photo clearly shows a famous person (actor, musician, athlete, creator, politician, royal, artist, entrepreneur, etc.), set identified=true, confidence="high", best_name to their most common public name, and list any other plausible names.
- If the image is unclear, blurry, a group shot, an object, a meme, a child, a private/non-famous person, or you have any real doubt, set identified=false, confidence="low", best_name=null, and explain in reason why a clearer image is needed.
- NEVER guess. It is better to reject a photo than to misidentify a person.`;

export function identifyPerson(c: GeminiCredential, imageDataUri: string) {
  return geminiJson<{
    identified: boolean;
    best_name: string | null;
    names: string[];
    confidence: "high" | "low";
    reason: string | null;
  }>({
    credential: c,
    system: IDENTIFY_SYSTEM,
    userText: "Look at this photo. Identify whether it clearly shows one well-known public figure. Respond only in JSON per the schema.",
    imageDataUri,
    schema: IDENTIFY_SCHEMA,
    temperature: 0,
  });
}

const PROFILE_SYSTEM = `You are a meticulous celebrity researcher for the "CelebrityPass" fan-card platform.
You research ONE identified person using live web search and return a structured profile for admin review.
Rules:
- Use Google Search grounding to verify every fact. NEVER invent information, URLs, follower counts, or prices from memory alone.
- name: the person's most common public display name.
- category: pick EXACTLY one of: Actor | Musician | Athlete | Creator | Public Figure | Artist.
- profession: concise factual headline, e.g. "Singer & Songwriter" or "Footballer".
- country / city: birthplace or primary residence country/city, null only if truly unknown.
- website: the person's verified OFFICIAL website, else null.

SOCIAL LINKS (critical — only these 4 platforms are supported):
socials supports EXACTLY four keys: facebook, instagram, tiktok, google.
- Each URL MUST be the verified OFFICIAL account of THIS exact person, confirmed by the web search results.
- Verification evidence: the account is linked from the person's official website, an official press release, a verified badge on the platform itself, Wikipedia/Wikidata, or consistent listings across authoritative sources (official site, reputable press, the platform's own verified profile). A username or profile name that merely matches the celebrity's name is NOT sufficient proof.
- NEVER use fan accounts, impersonators, tribute pages, unofficial pages, or guessed URLs.
- For google: prefer the person's verified Google presence — an official Google Business/profile or their Google Knowledge Panel — or if none is confirmed, an official-result Google search page for the person (e.g. https://www.google.com/search?q=<person's exact name>). Only provide something when you confirmed it; otherwise null.
- If you could NOT reliably verify an official account on a platform, return null for that platform. Do NOT guess, never fabricate a handle or URL.
- URLs must come from the search results you actually saw.

- followers: published follower counts ONLY when the search results show them; otherwise null (the platform fills realistic placeholders).
- accent_color: suggest a fitting brand hex color (e.g. "#8b5cf6").
- card_design: badge_text like "OFFICIAL FAN MEMBER", a short watermark, and an accent hex.
- base_memberships: EXACTLY 2 paid tiers, matching this platform's standard membership scheme: LEVEL 1 "Premium" priced $1,000 USD and LEVEL 2 "VIP" priced $1,700 USD. There is NO free tier and no other base tier. Keep the names "Premium" and "VIP" exactly; provide an accessible, factual description per tier. Do NOT invent different prices.
- source_urls: the real public URLs (authoritative: official site, verified socials, Wikipedia, reputable press) you actually used for evidence. Include at least 1 and at most 8.
- Return null for anything you could NOT verify. Do not fabricate.`;

function profilePrompt(name: string): string {
  return `Research this celebrity: ${name}.
Return the complete profile JSON for admin review. Only verified facts are allowed.`;
}

export function researchProfile(c: GeminiCredential, name: string, useSearch: boolean) {
  return geminiJson<{
    name: string;
    aliases?: string[];
    category: string;
    profession: string;
    country: string;
    city: string | null;
    website: string | null;
    accent_color: string;
    followers: { instagram: number | null; tiktok: number | null; facebook: number | null };
    socials: {
      facebook: string | null;
      instagram: string | null;
      tiktok: string | null;
      google: string | null;
    };
    card_design: { badge_text: string | null; watermark: string | null; accent: string | null };
    base_memberships: Array<{ name: string; description: string; price: number | null; currency: string }>;
    source_urls: string[];
  }>({
    credential: c,
    system: PROFILE_SYSTEM,
    userText: profilePrompt(name),
    schema: PROFILE_SCHEMA,
    useSearch,
    temperature: 0.2,
  });
}

const EVENTS_SYSTEM = `You are a public-event researcher for "CelebrityPass".
You research ONE celebrity's publicly announced events using live web search and return a JSON list.
Rules:
- Only include PUBLICLY ANNOUNCED events (concerts, tours, festivals, premieres, appearances) that you verified in the web search results.
- Every event MUST include a real source_url from the search results. If you cannot find a credible public source, do NOT include the event.
- type: one of: Concert | Tour | Festival | Public appearance | Award ceremony | Movie premiere | TV appearance | Public interview | Sports appearance | Charity/public event | Other.
- start_date: YYYY-MM-DD of the announced start. start_time: local HH:MM (24h) if announced, else null. timezone: IANA name if known.
- official_url: the artist/venue official event page if found, else null.
- List at least 0 and at most 12 events. Prefer current/upcoming announced events.`;

function eventsPrompt(name: string): string {
  return `Search for ${name}'s publicly announced events (concerts, tours, appearances). Return the JSON list — only verified events with real source URLs.`;
}

export function researchEvents(c: GeminiCredential, name: string, useSearch: boolean) {
  return geminiJson<{
    events: Array<{
      name: string;
      type: string;
      description: string | null;
      venue: string | null;
      city: string | null;
      country: string | null;
      start_date: string;
      start_time: string | null;
      timezone: string | null;
      official_url: string | null;
      source_url: string | null;
    }>;
  }>({
    credential: c,
    system: EVENTS_SYSTEM,
    userText: eventsPrompt(name),
    schema: EVENTS_SCHEMA,
    useSearch,
    temperature: 0.2,
  });
}

/**
 * Try a step across an ordered credential chain. Transient failures are
 * retried with backoff before moving on; key-level blocks (invalid, quota,
 * billing, suspended/restricted, disabled) skip to the next credential.
 * Terminal errors (e.g. search+JSON not supported) propagate for the caller
 * to handle.
 */
export async function callAcrossCredentials<T>(
  pairs: GeminiCredential[],
  fn: (c: GeminiCredential) => Promise<T>,
): Promise<{ value: T; used: GeminiCredential }> {
  const transientAttempts = 3;
  const errors: { type: string; label: string; message: string }[] = [];
  let quotaRefillTried = false;
  for (const pair of pairs) {
    for (let attempt = 1; attempt <= transientAttempts; attempt++) {
      try {
        const value = await fn(pair);
        return { value, used: pair };
      } catch (e) {
        if (!(e instanceof AiCallError)) throw e;
        const transient = e.type === "network" || e.type === "server" || e.type === "timeout";
        const keyBlock = [
          "invalid_key",
          "permission",
          "api_disabled",
          "model",
          "billing",
          "project_restriction",
        ].includes(e.type);
        if (transient && attempt < transientAttempts) {
          await sleep(750 * attempt); // 0.75s / 1.5s backoff
          continue;
        }
        if (e.type === "quota") {
          // Free-tier per-minute windows refill in a few seconds. Give the run
          // ONE short refill wait instead of walking every credential with the
          // old 10s/20s sleeps (which made a scan hang for minutes and then get
          // killed by the route timeout).
          if (!quotaRefillTried) {
            quotaRefillTried = true;
            await sleep(3_000);
            try {
              const value = await fn(pair);
              return { value, used: pair };
            } catch (e2) {
              if (e2 instanceof AiCallError && (e2.type === "quota" || e2.type === "timeout")) {
                errors.push({ type: e2.type, label: pair.label, message: e2.message });
                break; // quota is scan-wide — do not keep hammering the chain
              }
              throw e2;
            }
          }
          errors.push({ type: e.type, label: pair.label, message: e.message });
          break;
        }
        if (keyBlock) {
          errors.push({ type: e.type, label: pair.label, message: e.message });
          break; // this key/model is blocked — try the next pair
        }
        throw e; // terminal for this step (e.g. unsupported_combination)
      }
    }
  }
  const first = errors[0];
  const label = first?.message ?? "";
  // Preserve the real first cause (quota/billing/permission/...) instead of
  // misreporting every failure as a rejected key.
  const type = (first?.type as AiErrorType) ?? "invalid_key";
  const friendly =
    type === "permission" || type === "api_disabled" ? "permission" : type === "quota" ? "quota" : type;
  throw new AiCallError(
    friendly,
    `No working Gemini credential ${label ? `(${label})` : ""}${errors.length > 1 ? " — also tried the fallback credentials" : ""}`,
  );
}