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
 *   AI_ASSIST_GEMINI_KEY        its own Gemini key (required for live AI)
 *   AI_ASSIST_GEMINI_MODEL      default "gemini-2.5-flash" (scanner defaults to
 *                               a different model, so the two never share quota
 *                               or interference)
 *   AI_ASSIST_GEMINI_BASE_URL   default https://generativelanguage.googleapis.com/v1beta
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
  return process.env.AI_ASSIST_GEMINI_KEY?.trim() || null;
}

function getGeminiModel(): string {
  return process.env.AI_ASSIST_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
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
    process.env.AI_ASSIST_GEMINI_BASE_URL?.trim() || "https://generativelanguage.googleapis.com/v1beta"
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
 * Deterministic offline fallback so the "✨ AI Reply" button always responds,
 * even when no Gemini key is configured or the provider is unreachable.
 */
function fallbackReply(ctx: {
  celebrityName: string;
  style: string | null;
  fanFirstName: string | null;
  lastFanMessage: string | null;
  lastTeamReply: string | null;
}): string {
  const { fanFirstName, lastFanMessage, lastTeamReply } = ctx;
  const name = fanFirstName ?? "friend";
  const intent = detectIntent(lastFanMessage ?? "");

  const stylePhrases: Record<string, string> = {
    "Friendly and warm": `It really means a lot to me that you took the time to reach out, ${name}.`,
    "Playful and fun": `You have no idea how much that put a smile on my face, ${name}.`,
    "Professional and polished": `Thank you for reaching out — I truly appreciate you, ${name}.`,
    "Inspiring and motivational": `That kind of energy from fans like you is exactly what keeps me going, ${name}.`,
    "Focused on music/art/sport": `Comments like yours remind me why I pour everything into my craft, ${name}.`,
    "Quiet and sincere": `That genuinely means a lot, ${name}. Thank you.`,
  };
  const warm = stylePhrases[ctx.style ?? ""] ?? stylePhrases["Friendly and warm"];

  const endings: Record<string, string> = {
    greeting: `So glad you found your way here, ${name} — I hope you'll stick around for what's coming next!`,
    thanks: `${warm} Let's keep this energy going — it means the world to me.`,
    praise: `${warm} Knowing my work connects with you is honestly what makes it all worth it.`,
    question: `Great question, ${name}! I'm with my team right now, but we'll make sure you get a proper answer soon.`,
    support: `Thank you, ${name} — your kindness truly doesn't go unnoticed, and I appreciate you being here for me too.`,
    general: `${warm} Keep spreading that good energy, ${name}!`,
  };

  let reply = `${endings[intent]} ${warm}`;
  if (lastTeamReply && reply.includes(shorten(lastTeamReply).slice(0, 40))) {
    reply = `${endings[intent]} Stay close, ${name}!`;
  }
  return clean(reply);
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
  const lastTeamReply = [...messages].reverse().find((m) => m.senderType === "team");

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
    "You are the AI reply assistant for a celebrity community on CelebrityPass.",
    "You help the celebrity's team draft replies to fans. The fan is a real person; the draft is always reviewed and approved by the team before it is sent.",
    `The celebrity is ${celebrity.name}, a ${celebrity.profession} from ${celebrity.country}.`,
    celebrity.bio ? `Short bio: ${shorten(celebrity.bio)}.` : null,
    `Response style to match: ${finalStyle}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const rules = [
    "Write a natural, personal, conversational reply that reads like the celebrity's team cheerfully acknowledging the fan — never like a customer-service bot.",
    "Respond directly to what the fan actually said (greeting, compliment, question or request).",
    "Use the fan's first name at most once, naturally.",
    "Keep it to 1-3 short sentences (roughly 15-40 words). Do not ask open-ended interview questions.",
    "Never repeat phrases or wording the team already used in this conversation.",
    "Never invent facts, meetings, gifts, events, dates, promises, or schedule commitments.",
    "Never mention the fan's email, phone, address, payment or any private detail.",
    "Do not mention that this reply is AI-generated, and do not claim the celebrity personally typed it.",
    "No emoji unless the style calls for it and it fits naturally.",
    "Output ONLY the reply text. No preamble, no quotes around it, no labels.",
  ].join("\n");

  const userPrompt = `Conversation so far (oldest to newest):\n${history}\n\nDraft the reply to the fan's latest message now.`;

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
        lastTeamReply: lastTeamReply ? shorten(lastTeamReply.body) : null,
      }),
      provider: "fallback",
      model: null,
      ...meta,
    };
  }
}