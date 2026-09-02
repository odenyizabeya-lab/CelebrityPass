/**
 * AI celebrity scanner.
 *
 * Upload an image of a person and the model identifies who it is and returns a
 * complete field set (name, category, profession, country, city, bios, accent
 * colour, socials, follower counts) so the admin form can be auto-filled with
 * nothing left empty. The admin can then review/edit before saving.
 *
 * Uses the Gemini vision API. The API key is read server-side from the
 * admin-managed AI settings (it is never sent to the browser).
 */

import { getAiApiKey } from "./settings";

export type ScannedCelebrity = {
  name: string;
  category: string;
  profession: string;
  country: string;
  city: string;
  shortBio: string;
  bio: string;
  website: string; // may be an official/social URL the model is confident about
  instagramUrl: string;
  xUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  accentColor: string;
  instagramFollowers: number | null;
  tiktokFollowers: number | null;
  facebookFollowers: number | null;
};

export type ScanResult = { ok: true; data: ScannedCelebrity } | { ok: false; error: string; hint?: string };

const PROMPT = `You are a celebrity fact engine. Inspect the picture and identify the person shown and their community background.

Return ONLY valid JSON (no markdown, no commentary) shaped EXACTLY like this:
{
  "name": "Full public name",
  "category": "field of fame, e.g. Music, Sports, Film, TV, Modeling, Business, Politics, YouTube",
  "profession": "short role line, e.g. Singer & Songwriter",
  "country": "home country, e.g. United States",
  "city": "primary city, e.g. New York",
  "shortBio": "one to two concise sentences summarizing who they are and what they are known for",
  "bio": "a longer, 3-5 sentence community/profile description",
  "website": "official website if confidently known, else empty string",
  "instagramUrl": "official Instagram profile URL if confidently known, else empty string",
  "xUrl": "official X/Twitter profile URL if confidently known, else empty string",
  "youtubeUrl": "official YouTube channel URL if confidently known, else empty string",
  "tiktokUrl": "official TikTok profile URL if confidently known, else empty string",
  "facebookUrl": "official Facebook profile URL if confidently known, else empty string",
  "accentColor": "a brand-relevant hex color like #8b5cf6",
  "instagramFollowers": approximate public follower count as a number, or null if unknown,
  "tiktokFollowers": approximate public follower count as a number, or null if unknown,
  "facebookFollowers": approximate public follower count as a number, or null if unknown
}

Rules:
- Never invent a social/website URL you are not confident about; use "" for unknowns.
- Follower counts: give best-effort realistic published ranges as numbers, or null when truly unknown.
- If the image does not clearly show a real recognizable public person, still return your best identification; if there is no clear person, leave name empty.`;

const GEMINI_MODEL = "gemini-3.5-flash";

function stripJson(text: string): string {
  // Handle code fences and stray prose around the JSON object.
  const fenced = text.trim().match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return candidate.slice(start, end + 1);
  }
  return candidate;
}

function fallback(value: unknown, dflt: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : dflt;
}

function mapCelebrity(jsonRaw: Record<string, unknown>): ScannedCelebrity {
  const json = jsonRaw;
  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.round(v);
    const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };
  const hex = (v: unknown): string => {
    const s = String(v ?? "").trim();
    return /^#?[0-9a-fA-F]{6}$/.test(s) ? (s.startsWith("#") ? s : `#${s}`) : "#8b5cf6";
  };
  return {
    name: fallback(json.name, ""),
    category: fallback(json.category, "Public Figure"),
    profession: fallback(json.profession, ""),
    country: fallback(json.country, ""),
    city: fallback(json.city, ""),
    shortBio: fallback(json.shortBio, ""),
    bio: fallback(json.bio, ""),
    website: fallback(json.website, ""),
    instagramUrl: fallback(json.instagramUrl, ""),
    xUrl: fallback(json.xUrl, ""),
    youtubeUrl: fallback(json.youtubeUrl, ""),
    tiktokUrl: fallback(json.tiktokUrl, ""),
    facebookUrl: fallback(json.facebookUrl, ""),
    accentColor: hex(json.accentColor),
    instagramFollowers: num(json.instagramFollowers),
    tiktokFollowers: num(json.tiktokFollowers),
    facebookFollowers: num(json.facebookFollowers),
  };
}

/** Send the profile image's base64 data-URI to Gemini and return the fields. */
export async function scanCelebrityImage(imageDataUri: string): Promise<ScanResult> {
  const apiKey = await getAiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: "Your AI scan key isn't set yet.",
      hint: "Add it in Admin → AI Scanner first, then come back and Scan again.",
    };
  }

  const { base64 } = splitDataUri(imageDataUri);
  if (!base64) {
    return { ok: false, error: "That doesn't look like a valid image upload.", hint: "Try a JPG or PNG file." };
  }

  const result = await callJsonModel(apiKey, base64, PROMPT, (json) => mapCelebrity(json));
  if (!result.ok) return result;

  if (!result.data.name) {
    return { ok: false, error: "The image didn't show a clear recognizable public person.", hint: "Try a clearer, larger photo." };
  }
  return { ok: true, data: result.data };
}

export type ScannedMembership = {
  name: string;
  description: string;
  benefits: string;
  price: number | null;
  currency: string;
};

export type MembershipScanResult =
  | { ok: true; data: ScannedMembership }
  | { ok: false; error: string; hint?: string };

const MEMBERSHIP_PROMPT = `Look at this picture of a celebrity / public figure. Recommend ONE community membership level for their fan club with a fee structure that fits their fame and audience.

Think about what makes sense for this person's fan community and return a sensible, honest tier. Choose a realistic pricing band based on the person's prominence (famous entertainers/athletes usually sit higher, emerging talent lower). Always keep the value for fans realistic and fair.

Return ONLY valid JSON (no markdown, no commentary) shaped EXACTLY like:
{
  "name": "a short tier name, e.g. Community Member, Core Fan, VIP, Insider, Superfan",
  "description": "one or two sentences describing the tier and who it is for",
  "benefits": "a concise, comma- or bullet-separated list of the perks members get in this tier",
  "price": "a proposed membership price in whole dollars (a positive number, or null for a free tier)",
  "currency": "3-letter currency code, default USD"
}

Rules:
- Do NOT invent discounts or celebrity-endorsed pricing claims. Propose a neutral, fair market value for a fan membership tier.
- price must be a number >= 0, or null if this tier should be free.
- currency should be a real ISO code (000 default "USD").`;

export async function scanMembershipForPhoto(imageDataUri: string): Promise<MembershipScanResult> {
  const apiKey = await getAiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: "Your AI scan key isn't set yet.",
      hint: "Add it in Admin → AI Scanner first, then come back and Scan again.",
    };
  }
  const { base64 } = splitDataUri(imageDataUri);
  if (!base64) {
    return { ok: false, error: "That doesn't look like a valid image upload.", hint: "Try a JPG or PNG file." };
  }
  return callJsonModel(apiKey, base64, MEMBERSHIP_PROMPT, (json) => {
    const currency = fallback(json.currency, "USD").toUpperCase();
    const priceRaw = json.price;
    let price: number | null = null;
    if (typeof priceRaw === "number" && Number.isFinite(priceRaw) && priceRaw >= 0) {
      price = Math.round(priceRaw * 100) / 100;
    } else if (typeof priceRaw === "string" && priceRaw.trim() !== "") {
      const n = Number(priceRaw.replace(/[^0-9.]/g, ""));
      if (Number.isFinite(n) && n >= 0) price = Math.round(n * 100) / 100;
    }
    return {
      name: fallback(json.name, "Community Member"),
      description: fallback(json.description, ""),
      benefits: fallback(json.benefits, ""),
      price,
      currency: /^[A-Za-z]{3}$/.test(currency) ? currency : "USD",
    };
  });
}

async function callJsonModel<T extends Record<string, unknown>>(
  apiKey: string,
  base64: string,
  prompt: string,
  map: (json: Record<string, unknown>) => T,
): Promise<{ ok: true; data: T } | { ok: false; error: string; hint?: string }> {
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64 } }] }],
        }),
      },
    );
  } catch (e) {
    return { ok: false, error: "Could not reach the AI service.", hint: e instanceof Error ? e.message : "Check your network connection." };
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message ?? "";
    } catch {
      detail = "";
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      const suspended = /suspend/i.test(detail);
      return {
        ok: false,
        error: suspended ? "This AI key has been suspended by Google." : "The AI key was rejected.",
        hint: detail || (suspended ? "Get a new key at aistudio.google.com/apikey." : undefined),
      };
    }
    return { ok: false, error: `AI service error (${response.status}).`, hint: detail || undefined };
  }

  let payload: { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return { ok: false, error: "The AI service returned an unreadable response." };
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    return { ok: false, error: "The AI did not return any text for this image." };
  }

  try {
    const json = JSON.parse(stripJson(text)) as Record<string, unknown>;
    return { ok: true, data: map(json) };
  } catch {
    return { ok: false, error: "The AI returned malformed data for this image.", hint: "Try another photo." };
  }
}

function splitDataUri(dataUri: string): { base64: string; mime: string | null } {
  const m = /^data:([a-zA-Z0-9/+.-]+);base64,([\s\S]+)$/.exec(dataUri.trim());
  if (!m) return { base64: "", mime: null };
  return { base64: m[2], mime: m[1] };
}