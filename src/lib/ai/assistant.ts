import { prisma } from "@/lib/db";

/**
 * AI Reply Assistant — its OWN Gemini system, fully separate from the scanner.
 *
 * This module is a completely independent AI subsystem from `src/lib/ai/scanner.ts`
 * (which re-identifies celebrities with Google Gemini research). It shares no
 * key, no code, no prompts, no models and no settings with the scanner, and it
 * NEVER falls back to the scanner's key. The assistant is powered by a
 * dedicated Gemini key the owner supplies:
 *
 *   ASSIST_GEMINI_KEY        its own Gemini key (required for live replies)
 *   ASSIST_GEMINI_MODEL      default "gemini-2.5-flash" (scanner defaults to
 *                            a different model, so the two never share quota)
 *   ASSIST_GEMINI_BASE_URL   default https://generativelanguage.googleapis.com/v1beta
 *
 * It drafts suggested replies in the celebrity's voice that the team reviews,
 * edits and approves in the admin chat room before anything is sent. The draft
 * the team approves is always sent as a normal team message — this assistant
 * never claims the celebrity personally wrote something, and it never
 * auto-sends on its own.
 *
 * Privacy: the prompt contains only the fan's first name and the conversation
 * text. Fan emails, phone numbers, payment details and ids are never sent to
 * the model.
 */

export type SuggestionResult = {
  text: string;
  provider: "gemini" | "fallback";
  model: string | null;
  celebrityName: string;
  style: string | null;
  /** Whether the assistant's own Gemini key is configured (live AI enabled). */
  configured: boolean;
};

const MAX_HISTORY = 12;
const MAX_BODY_CHARS = 600;
const MAX_OUTPUT_CHARS = 2000;
const STYLE_PRESETS = [
  "Friendly and warm",
  "Playful and fun",
  "Professional and polished",
  "Inspiring and motivational",
  "Focused on music/art/sport",
  "Quiet and sincere",
] as const;

export const DEFAULT_AI_STYLE = "Friendly and warm";

export function stylePresets(): readonly string[] {
  return STYLE_PRESETS;
}

/** The assistant's OWN Gemini key — never the scanner's. */
function getGeminiKey(): string | null {
  return process.env.ASSIST_GEMINI_KEY?.trim() || null;
}

function getGeminiModel(): string {
  return process.env.ASSIST_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function shorten(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > MAX_BODY_CHARS ? `${t.slice(0, MAX_BODY_CHARS)}…` : t;
}

/** Strip wrapping quotes/markdown bullets and collapse to a single line. */
function clean(text: string): string {
  let t = text.trim();
  t = t.replace(/^(["'“”‘’]+)/, "").replace(/["'“”‘’]+$/, "");
  t = t.replace(/^-\s+/, "").replace(/\s*\n\s*/g, " ");
  t = t.trim();
  return t.length > MAX_OUTPUT_CHARS ? t.slice(0, MAX_OUTPUT_CHARS) : t;
}

async function geminiComplete(system: string, user: string): Promise<string> {
  const key = getGeminiKey();
  if (!key) throw new Error("Gemini key is not configured for the reply assistant");
  const base = (
    process.env.ASSIST_GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta"
  ).replace(/\/+$/, "");
  const model = getGeminiModel();

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch(`${base}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Gemini provider returned ${res.status}`);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: { blockReason?: string };
    };
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("").trim();
    if (!text && data?.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the request (${data.promptFeedback.blockReason})`);
    }
    if (!text) throw new Error("Gemini returned an empty response");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function detectIntent(t: string): "greeting" | "thanks" | "praise" | "question" | "support" | "general" {
  const s = t.toLowerCase();
  if (/\b(hi|hey|hello|hiya|yo|hola|greetings|good (morning|afternoon|evening|night))\b/.test(s)) return "greeting";
  if (/\b(thank|thanks|thx|grateful|appreciate)\b/.test(s)) return "thanks";
  if (/\b(love|adore|biggest fan|huge fan|inspired|inspiring|amazing|idol|obsessed)\b/.test(s)) return "praise";
  if (t.includes("?") || /^(who|what|when|where|why|how|will you|can you|do you|are you|would you|is it)\b/i.test(s)) return "question";
  if (/\b(hope|wish|please|pray|missing|sad|going through|support)\b/.test(s)) return "support";
  return "general";
}

/**
 * Deterministic offline fallback so the "Suggest reply" button always responds,
 * even when no Gemini key is configured or the provider is unreachable.
 * Written to sound like a real person's text, not a bot.
 */
function fallbackReply(ctx: {
  celebrityName: string;
  style: string | null;
  fanFirstName: string | null;
  lastFanMessage: string | null;
}): string {
  const { lastFanMessage } = ctx;
  const name = fanFirstNameTrim(ctx.fanFirstName);
  const intent = detectIntent(lastFanMessage ?? "");

  const replies: Record<string, string> = {
    greeting: `Hey ${name}!! So glad you found your way here — stick around, there's lots of good stuff coming.`,
    thanks: `Aw ${name}, thank you! That honestly means so much to me.`,
    praise: `${name}, that means the world to me — seriously, thank you!`,
    question: `Great question, ${name}! I'll get you a proper answer as soon as I can.`,
    support: `Sending you love, ${name}. Knowing you're here for me like this? Means everything.`,
    general: `${name}, thank you for the message — it genuinely made my day!`,
  };

  const playful = (ctx.style ?? "").toLowerCase().includes("playful");
  const polished = (ctx.style ?? "").toLowerCase().includes("professional");
  let reply = replies[intent];

  if (polished) {
    reply = `${replies[intent]} I really appreciate you reaching out.`;
  } else if (playful) {
    const fun = `${replies[intent]} You're the best, keep being you!`;
    if (detectIntent(lastFanMessage ?? "") === "greeting") {
      reply = `Hey ${name}!! Welcome — you fit right in around here.`;
    } else {
      reply = fun;
    }
  } else if (detectIntent(lastFanMessage ?? "") === "greeting" && intent !== "greeting") {
    reply = replies[intent];
  }

  return clean(reply);
}

function fanFirstNameTrim(fanFirstName: string | null): string {
  return fanFirstName ?? "friend";
}

export async function suggestReply(conversationId: string): Promise<SuggestionResult> {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: {
      celebrity: {
        select: { name: true, profession: true, country: true, bio: true, chatAiStyle: true },
      },
      fan: { select: { name: true } },
    },
  });
  if (!conversation) throw new Error("Conversation not found");
  const { celebrity, fan } = conversation;

  const raw = await prisma.chatMessage.findMany({
    where: { conversationId, deletedAt: null, type: "text" },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY,
    select: { senderType: true, body: true, createdAt: true },
  });
  const messages = raw.slice().reverse();
  const latestFan = [...messages].reverse().find((m) => m.senderType === "fan");

  const fanFirstName = fan.name.trim().split(/\s+/)[0] || null;
  const style = celebrity.chatAiStyle?.trim() || null;
  const finalStyle = style || DEFAULT_AI_STYLE;

  const history =
    messages.length === 0
      ? "(the fan just opened this conversation — no messages yet)"
      : messages
          .map((m) => `- ${m.senderType === "fan" ? (fanFirstName ? `${fanFirstName} (fan)` : "Fan") : "Team"}: ${shorten(m.body)}`)
          .join("\n");

  const systemInstruction = [
    "You write short chat messages for a celebrity community on CelebrityPass.",
    "You draft a message FROM the celebrity to one of their fans, in the celebrity's own voice — exactly as if the celebrity personally sat down and texted them back.",
    "The celebrity reviews and approves the message before it is sent, so it is safe to write in their voice.",
    `The celebrity is ${celebrity.name}, a ${celebrity.profession} from ${celebrity.country}.`,
    celebrity.bio ? `Short bio: ${shorten(celebrity.bio)}.` : null,
    `Signature style to write in: ${finalStyle}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const rules = [
    "Write LIKE THE CELEBRITY, warm and personal — never like a virtual assistant, bot or customer-service script.",
    "Text the way a real person texts: short sentences, natural rhythm, everyday contractions (I'm, it's, you'll), room for personality.",
    "Never present yourself as an assistant, system, bot, program, or an answering service. Write as the celebrity would, first person.",
    "Never let on that anything assisted with the message — no mention of drafts, tools, automation, reviews, or anyone else helping.",
    "No form-letter phrases (I hope this message finds you well, Thank you for your inquiry, etc.), no bullet points, no headings.",
    "Reply to what the fan actually said — their greeting, compliment, question or message.",
    "Use the fan's first name at most once, naturally and only when it fits.",
    "Keep it short and human: typically 1-3 short sentences. Vary how replies start so nothing sounds templated or repetitive.",
    "Never invent facts, meetings, gifts, events, dates, promises, or commitments.",
    "Never mention the fan's email, phone, address, payment or other private details.",
    "No emoji unless the style calls for it and it lands naturally.",
    "Output ONLY the reply text. No quotes, no labels, no preamble.",
  ].join("\n");

  const userPrompt = `Conversation so far (oldest to newest):\n${history}\n\nWrite the message the celebrity would send back now.`;

  const meta = {
    celebrityName: celebrity.name,
    style: finalStyle,
    configured: Boolean(getGeminiKey()),
  };
  try {
    const text = await geminiComplete(`${systemInstruction}\n\nRules:\n${rules}`, userPrompt);
    return {
      text: clean(text),
      provider: "gemini",
      model: getGeminiModel(),
      ...meta,
    };
  } catch {
    return {
      text: fallbackReply({
        celebrityName: celebrity.name,
        style: finalStyle,
        fanFirstName,
        lastFanMessage: latestFan ? shorten(latestFan.body) : null,
      }),
      provider: "fallback",
      model: null,
      ...meta,
    };
  }
}