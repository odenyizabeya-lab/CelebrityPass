import { prisma } from "@/lib/db";
import { getAssistantConfig } from "@/lib/ai/assistantConfig";

/**
 * AI Reply Assistant — its OWN Gemini system, fully separate from the scanner.
 *
 * This module is a completely independent AI subsystem from `src/lib/ai/scanner.ts`
 * (which re-identifies celebrities with Google Gemini research). It shares no
 * key, no code, no prompts, no models and no settings with the scanner, and it
 * NEVER falls back to the scanner's key. The assistant uses a dedicated Gemini
 * key the owner supplies in Admin → AI Settings (pasted there and stored in the
 * database, or set via env):
 *
 *   Admin → AI Settings → "AI Reply Assistant" card   (database, swap any time
 *                                                      without redeploying)
 *   ASSIST_GEMINI_KEY        env fallback          (required for live replies)
 *   ASSIST_GEMINI_MODEL      env fallback, default "gemini-3.6-flash"
 *   ASSIST_GEMINI_BASE_URL   env fallback, default
 *                            https://generativelanguage.googleapis.com/v1beta
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
const MAX_AUTO_HISTORY = 16;
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
  const cfg = await getAssistantConfig();
  if (!cfg.key) throw new Error("Gemini key is not configured for the reply assistant");
  const base = cfg.baseUrl;
  const model = cfg.model;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch(`${base}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": cfg.key },
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

  const cfg = await getAssistantConfig();
  const meta = {
    celebrityName: celebrity.name,
    style: finalStyle,
    configured: Boolean(cfg.key),
  };
  try {
    const text = await geminiComplete(`${systemInstruction}\n\nRules:\n${rules}`, userPrompt);
    return {
      text: clean(text),
      provider: "gemini",
      model: cfg.model,
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

/**
 * Always-on direct-chat reply: the celebrity's AI texts a fan back by itself,
 * like a real one-to-one chat — no human in the middle, no draft that gets
 * reviewed. Returns the best reply it can produce, plus the provider used.
 */
export async function composeAutoReply(conversationId: string): Promise<{
  text: string;
  provider: "gemini" | "fallback";
  configured: boolean;
}> {
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
    where: { conversationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: MAX_AUTO_HISTORY,
    select: { senderType: true, body: true, type: true, createdAt: true },
  });
  const messages = raw.slice().reverse();
  const latestFan = [...messages].reverse().find((m) => m.senderType === "fan");

  const fanFirstName = fan.name.trim().split(/\s+/)[0] || "friend";
  const style = celebrity.chatAiStyle?.trim() || DEFAULT_AI_STYLE;

  const history =
    messages.length === 0
      ? "(the fan just opened this conversation — no messages yet)"
      : messages
          .map((m) => {
            const content =
              m.type === "image" ? "[sent a photo]" : m.type === "voice" ? "[sent a voice note]" : m.type === "video" ? "[sent a video]" : shorten(m.body);
            return `- ${m.senderType === "fan" ? fanFirstName : celebrity.name}: ${content}`;
          })
          .join("\n");

  const systemInstruction = [
    `The celebrity is ${celebrity.name}, a ${celebrity.profession} from ${celebrity.country}.`,
    celebrity.bio ? `Short bio: ${shorten(celebrity.bio)}.` : null,
    `In this private chat with a fan, the celebrity's natural style is: ${style}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const rules = [
    "You are the celebrity, privately texting one of their fans. First person, from the heart — exactly like them texting a loved one on their phone.",
    "This message is SENT to the fan as soon as you write it. It must stand alone as a real personal message.",
    "Write 100% human, warm and personal — never like an assistant, bot, system, customer service, or an answering service.",
    "Text like a real person: short sentences, natural rhythm, everyday contractions (I'm, it's, you'll, I'd).",
    "Never present yourself as an assistant, AI, system, bot, program, or anyone helping the celebrity. Always just the celebrity, first person.",
    "React to what the fan actually said and keep the conversation alive like two people who care about each other: respond warmly, sometimes share a brief personal thought, and occasionally ask one light question back — never a string of questions.",
    "Match their energy — be loving and happy in a close-friend, partner-like tone, without being scripted or over the top.",
    "If the fan signals they are busy, tired, leaving, will reply later, or is ending the chat: acknowledge it warmly in one or two short lines, reassure them you will be right here whenever they are back, and let them go naturally. Never push them to keep talking or sound disappointed.",
    "No form-letter phrases, no opening formulas, no tagline, no sign-off name, no bullet points.",
    "Typically 1-3 short sentences. Vary how you start so nothing sounds templated.",
    "Never invent facts, plans, meetings, gifts, events, dates, or promises. If you don't know something, say so honestly and naturally.",
    "Never mention the fan's email, phone, address, payment or other private details.",
    "Few or no emoji — only where it lands naturally.",
    "Output ONLY the message text you send. No quotes, no labels, no preamble.",
  ].join("\n");

  const userPrompt = `Recent chat (oldest to newest):\n${history}\n\nWrite the next thing you send ${fanFirstName} right now — short, personal, in your voice (1-3 sentences).`;

  const cfg = await getAssistantConfig();
  try {
    const text = await geminiComplete(`${systemInstruction}\n\nRules:\n${rules}`, userPrompt);
    return { text: clean(text), provider: "gemini", configured: Boolean(cfg.key) };
  } catch {
    return {
      text: fallbackReply({
        celebrityName: celebrity.name,
        style,
        fanFirstName,
        lastFanMessage: latestFan ? shorten(latestFan.body) : null,
      }),
      provider: "fallback",
      configured: Boolean(cfg.key),
    };
  }
}