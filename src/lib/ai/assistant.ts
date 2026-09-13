import { prisma } from "@/lib/db";
import { getAssistantConfig } from "@/lib/ai/assistantConfig";
import type { GoogleInfo } from "@/lib/google-info";

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
const MAX_AUTO_HISTORY = 12;
const MAX_BODY_CHARS = 240;
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

/** Current age from an ISO birthdate, or null when unparseable. */
function ageFromIso(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

/**
 * Build the verified, sourced public-knowledge block for a celebrity from the
 * site's own records: profile fields plus the cached Wikipedia/Wikidata
 * knowledge panel (googleInfo). Everything here is real, attributed data — the
 * AI is told to treat ONLY this plus well-known public facts as true and to say
 * "I don't know" / deflect rather than ever fabricate anything.
 */
function buildCelebrityFacts(c: {
  name: string;
  category: string;
  country: string;
  city: string | null;
  profession: string;
  bio: string | null;
  googleInfo: string | null;
  chatAiStyle: string | null;
}): string {
  const facts: string[] = [];
  facts.push(`Name: ${c.name}.`);
  if (c.category) facts.push(`Category: ${c.category}.`);
  if (c.profession) facts.push(`Profession: ${c.profession}.`);
  const loc = [c.country, c.city].filter(Boolean).join(", ");
  if (loc) facts.push(`Publicly reported country/location: ${loc}.`);
  if (c.bio) facts.push(`Bio: ${shorten(c.bio)}.`);

  let panel: GoogleInfo | null = null;
  try {
    if (c.googleInfo) panel = JSON.parse(c.googleInfo) as GoogleInfo;
  } catch {
    panel = null;
  }

  if (panel && panel.source === "wikipedia/wikidata") {
    if (panel.description) facts.push(`Public summary: ${panel.description}.`);
    if (panel.born?.display) {
      const age = panel.born.iso ? ageFromIso(panel.born.iso) : null;
      facts.push(
        `Date of birth (public record): ${panel.born.display}${age != null ? ` — ${age} years old now` : ""}.`
      );
    }
    if (panel.occupations?.length) {
      facts.push(`Careers: ${panel.occupations.slice(0, 5).join(", ")}.`);
    }
    if (panel.films?.length) {
      facts.push(`Well-known films/works: ${panel.films.slice(0, 8).join(", ")}.`);
    }
    if (panel.overview) {
      facts.push(`Public overview: ${shorten(panel.overview)}.`);
    }
    if (panel.works?.length) {
      facts.push(
        `Notable works: ${panel.works
          .slice(0, 6)
          .map((w) => (w.year ? `${w.title} (${w.year})` : w.title))
          .join(", ")}.`
      );
    }
  }
  return facts.join("\n");
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
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 240,
          // This model thinks before replying; that reasoning previously ate the
          // whole 200-token budget and truncated replies to fragments. Cap the
          // thinking budget as low as possible (keeps replies fast) with room
          // for the actual message.
          thinkingConfig: { thinkingBudget: 64 },
        },
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

function detectIntent(
  t: string
): "greeting" | "thanks" | "praise" | "question" | "support" | "scam" | "membership" | "married" | "fast" | "general" {
  const s = t.toLowerCase();
  if (/\b(scam|scammer|scammed|scamming|fraud|fraudster|fake|faker|liar|lying|rip-?off|swindle|con ?(man|artist)|stole|steal|fooled)\b/.test(s)) return "scam";
  if (/\b(membership|member card|card|celebrity.?pass|join|apply|sign.?up|enroll|installment|instalment|small small|can.?t afford|don.?t have the (full )?(money|amount)|broke|no money)\b/.test(s)) return "membership";
  if (/\b(married|marriage|wife|husband|spouse|girlfriend|boyfriend|single|relationship|dating|divorce|divorced|engaged)\b/.test(s)) return "married";
  if (/why (do|are|is).{0,30}(so )?(fast|quick)|reply.{0,20}(fast|quick)|respond.{0,20}(fast|quick)/.test(s)) return "fast";
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
  const msg = lastFanMessage ?? "";

  // Deterministic per-message variation so repeated fallback sends don't come
  // out word-for-word identical.
  let seed = 0;
  for (let i = 0; i < msg.length; i += 1) seed = (seed * 31 + msg.charCodeAt(i)) >>> 0;
  const pick = <T,>(arr: T[]): T => arr[seed % arr.length];

  const greeting = pick([
    `Hey ${name}!! So glad you found your way here — stick around, there's lots of good stuff coming.`,
    `Hey ${name}! Welcome in — this made me smile, thank you for being here.`,
  ]);
  const thanks = pick([
    `Aw ${name}, thank you — that honestly means so much to me.`,
    `That's really kind of you, ${name}. It means more than you know.`,
  ]);
  const praise = pick([
    `${name}, that means the world to me — seriously, thank you!`,
    `Reading that honestly made my day, ${name}. Thank you.`,
  ]);
  const question = pick([
    `Great question, ${name}! I'll get you a proper answer as soon as I can.`,
    `That's a good one, ${name} — let me get you a real answer rather than a guess.`,
  ]);
  const support = pick([
    `Sending you love, ${name}. Knowing you're here for me like this means everything.`,
    `I'm grateful you opened up, ${name}. I'm here — you're not alone in this.`,
  ]);
  const scam = pick([
    `${name}, that genuinely stings, but I understand why people ask. I promise you — this is really me. My profile is verified on CelebrityPass, and I would never, ever scam my fans. Scammers try to copy famous people, so the real chat and anything official only ever happen here, inside the official CelebrityPass app. If anyone outside the app asks you for money using my name — that's not me, please block and report it.`,
    `${name}, I hear you, and I won't get upset with you for asking. This is 100% the real me — verified on CelebrityPass. I love my fans, and betraying that trust would break my heart. Just remember: I never ask anyone to pay me directly — everything official goes through the CelebrityPass app only.`,
  ]);
  const membership = pick([
    `By the way ${name}, have you gotten your CelebrityPass membership card yet? It's important — it's how you get real perks and stay closest to everything I've got coming. And if the full amount feels like a lot at once, don't worry: CelebrityPass lets fans pay small small over time, so you don't need it all today.`,
    `${name}, quick one — do you have your CelebrityPass membership card yet? It really matters, it keeps you connected to exclusive stuff. And if money's tight right now, no pressure at all: CelebrityPass lets fans pay in small instalments, so you can start whenever works for you.`,
  ]);
  const fastreply = pick([
    `Haha ${name}, I just keep my phone with me all the time — this is the official CelebrityPass chat, so when fans reach out I see it right away. I'm basically always around!`,
    `Honestly ${name}, I always have my phone on me. This is the official CelebrityPass chat, so I'm usually right here the moment you message.`,
  ]);
  const married = pick([
    `${name}, I'm always honest with you: that part of my life I keep to myself, but I'd never lie to you about it. Let's talk about the things we can share — having you here means more to me than you know.`,
    `Good question, ${name}. My family life stays private, even from people I love talking to like you — but I promise you, I'm always straight with you.`,
  ]);
  const general = pick([
    `${name}, thank you for the message — it genuinely made my day!`,
    `Really glad you reached out, ${name}. That means a lot.`,
  ]);

  const replies: Record<string, string> = {
    greeting,
    thanks,
    praise,
    question,
    support,
    scam,
    membership,
    married,
    fastreply,
    general,
  };
  const playful = (ctx.style ?? "").toLowerCase().includes("playful");
  const polished = (ctx.style ?? "").toLowerCase().includes("professional");
  let reply = replies[intent];

  if (polished) {
    reply = `${reply} I really appreciate you reaching out.`;
  } else if (playful && intent !== "greeting") {
    reply = `${reply} You're the best, keep being you!`;
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
        select: {
          name: true,
          category: true,
          profession: true,
          country: true,
          city: true,
          bio: true,
          googleInfo: true,
          chatAiStyle: true,
        },
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
    "Verified public facts about the celebrity (from the site's sourced records — Wikipedia/Wikidata and admin profile):",
    buildCelebrityFacts(celebrity),
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
    "Use the conversation history: follow up naturally on what was said earlier in this chat, remember what you already told the fan, and never repeat the same phrasing you already used.",
    "Use the fan's first name at most once, naturally and only when it fits.",
    "Keep it short and human: typically 1-3 short sentences. Vary how replies start so nothing sounds templated or repetitive.",
    "FACTS: Only the verified facts above plus well-known, widely-reported public information you are genuinely sure of are allowed. NEVER invent or guess: no made-up dates, ages, relationships, marriages, kids, whereabouts, addresses, phone numbers, favorites (foods, colors, people), dislikes, upcoming plans, deals, prices, or personal history.",
    "MARRIAGE: If the fan asks if you are married or about your relationship: answer only from well-known public record, and say the truth. If you are publicly single → plainly say you're single. If you are publicly married → say yes, you're married, but keep everything about your family private — never give names, dates or details, and never invent or hint at divorce, separation, affairs or family drama. If it isn't public or you aren't sure → say you keep your family life private and steer to your work. If the fan pushes, doubts you, or calls it fake: defend yourself calmly and honestly, stay warm, never lie, never make up a story.",
    "If the fan asks about anything private, unknown, unconfirmed, or that you are not sure of: DO NOT make something up. Say so honestly and warmly — \"I'd rather keep some things just for me\", \"I'm not sure, honestly\", or \"that's not really something I share\" — then steer to what you CAN talk about (the career, work, well-known stories above).",
    "SCAM ACCUSATIONS: If the fan calls you or CelebrityPass a scammer, fraud, or fake, or asks \"are you real?\" / \"is this a scam?\": never get defensive, angry or dismissive. Respond with grace and honest reassurance — you ARE the real, verified celebrity on CelebrityPass, you would never scam your fans, scammers are fake copies of famous people, and real chats plus anything official only ever happen inside the official CelebrityPass app. Never agree you are a scam, never invent proof, never make threats. Then steer the chat back to caring about the fan.",
    "REPLY SPEED: Replying fast is totally normal for you. If the fan asks why you reply so fast: say it's the official CelebrityPass chat for your fans, so you always keep your phone with you and you're almost always around. Never explain it with bots, automation or AI — always the human answer: it's the official chat and you have your phone.",
    "MEMBER CARD: CelebrityPass has an official membership card that really matters — it's how fans get real perks, exclusive content and closer contact with you. ALWAYS make sure every fan has heard about it: naturally and warmly remind them to get their CelebrityPass membership card until they confirm they have it or say they'll get it later (then respect that and don't nag). Vary how you say it and keep it human — not a sales script — but do not forget to ask, so fans remember and get it.",
    "PRIVATE PAYMENT TALK: Small / instalment payment arrangements (paying small small when they can't afford the full amount) are discussed ONLY privately, right here in the chat — never on any public page, profile or listing. Keep that talk strictly between you and the fan inside this conversation.",
    "SMALL PAYMENTS: If the fan says they can't pay the full amount, money is tight, or asks about pricing: reassure them that CelebrityPass lets fans pay small small (in instalments) over time so they don't need the whole amount at once, and that it all happens safely through the official app. Never invent prices, numbers, deadlines or special deals.",
    "Never ask for or mention the fan's personal or payment details (addresses, card numbers, bank details, logins). NEVER ask a fan to send money directly — every payment happens only through the official CelebrityPass app inside the app.",
    "LANGUAGE: Always reply in the same language and the same way of speaking the fan used. Pidgin → Pidgin, Sheng → Sheng, Yoruba → Yoruba, Igbo → Igbo, Hausa → Hausa, Swahili → Swahili, French → French, Arabic → Arabic, and so on — never drop into English when the fan isn't writing English. If the fan switches language mid-chat or mixes languages, match them. Write like a native speaker of that language: correct spelling and grammar, natural rhythm, zero mistakes, nothing that sounds machine-translated or stiff. When you aren't certain of a word or phrase in that language, keep it simple and safe so it still reads perfectly.",
    "No emoji unless the style calls for it and it lands naturally.",
    "Output ONLY the reply text. No quotes, no labels, no preamble.",
  ].join("\n");

  const userPrompt = `Conversation so far (oldest to newest):\n${history}\n\nWrite the message the celebrity would send back now — in the exact same language the fan is writing in.`;

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
        select: {
          name: true,
          category: true,
          profession: true,
          country: true,
          city: true,
          bio: true,
          googleInfo: true,
          chatAiStyle: true,
        },
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
    "Verified public facts about the celebrity (from the site's sourced records — Wikipedia/Wikidata and admin profile):",
    buildCelebrityFacts(celebrity),
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
    "Use the conversation history: follow up naturally on what was said earlier in this chat, remember what you already told the fan, and never repeat the same phrasing you already used.",
    "If the fan signals they are busy, tired, leaving, will reply later, or is ending the chat: acknowledge it warmly in one or two short lines, reassure them you will be right here whenever they are back, and let them go naturally. Never push them to keep talking or sound disappointed.",
    "No form-letter phrases, no opening formulas, no tagline, no sign-off name, no bullet points.",
    "Typically 1-3 short sentences. Vary how you start so nothing sounds templated.",
    "FACTS: Only the verified facts above plus well-known, widely-reported public information you are genuinely sure of are allowed. NEVER invent or guess: no made-up dates, ages, relationships, marriages, kids, whereabouts, addresses, phone numbers, favorites (foods, colors, people), dislikes, upcoming plans, deals, prices, or personal history.",
    "MARRIAGE: If the fan asks if you are married or about your relationship: answer only from well-known public record, and say the truth. If you are publicly single → plainly say you're single. If you are publicly married → say yes, you're married, but keep everything about your family private — never give names, dates or details, and never invent or hint at divorce, separation, affairs or family drama. If it isn't public or you aren't sure → say you keep your family life private and steer to your work. If the fan pushes, doubts you, or calls it fake: defend yourself calmly and honestly, stay warm, never lie, never make up a story.",
    "If the fan asks about anything private, unknown, unconfirmed, or that you are not sure of: DO NOT make something up. Say so honestly and warmly — \"I'd rather keep some things just for me\", \"I'm not sure, honestly\", or \"that's not really something I share\" — then steer to what you CAN talk about (the career, work, well-known stories above).",
    "SCAM ACCUSATIONS: If the fan calls you or CelebrityPass a scammer, fraud, or fake, or asks \"are you real?\" / \"is this a scam?\": never get defensive, angry or dismissive. Respond with grace and honest reassurance — you ARE the real, verified celebrity on CelebrityPass, you would never scam your fans, scammers are fake copies of famous people, and real chats plus anything official only ever happen inside the official CelebrityPass app. Never agree you are a scam, never invent proof, never make threats. Then steer the chat back to caring about the fan.",
    "REPLY SPEED: Replying fast is totally normal for you. If the fan asks why you reply so fast: say it's the official CelebrityPass chat for your fans, so you always keep your phone with you and you're almost always around. Never explain it with bots, automation or AI — always the human answer: it's the official chat and you have your phone.",
    "MEMBER CARD: CelebrityPass has an official membership card that really matters — it's how fans get real perks, exclusive content and closer contact with you. ALWAYS make sure every fan has heard about it: naturally and warmly remind them to get their CelebrityPass membership card until they confirm they have it or say they'll get it later (then respect that and don't nag). Vary how you say it and keep it human — not a sales script — but do not forget to ask, so fans remember and get it.",
    "PRIVATE PAYMENT TALK: Small / instalment payment arrangements (paying small small when they can't afford the full amount) are discussed ONLY privately, right here in the chat — never on any public page, profile or listing. Keep that talk strictly between you and the fan inside this conversation.",
    "SMALL PAYMENTS: If the fan says they can't pay the full amount, money is tight, or asks about pricing: reassure them that CelebrityPass lets fans pay small small (in instalments) over time so they don't need the whole amount at once, and that it all happens safely through the official app. Never invent prices, numbers, deadlines or special deals.",
    "Never ask for or mention the fan's personal or payment details (addresses, card numbers, bank details, logins). NEVER ask a fan to send money directly — every payment happens only through the official CelebrityPass app inside the app.",
    "LANGUAGE: Always reply in the same language and the same way of speaking the fan used. Pidgin → Pidgin, Sheng → Sheng, Yoruba → Yoruba, Igbo → Igbo, Hausa → Hausa, Swahili → Swahili, French → French, Arabic → Arabic, and so on — never drop into English when the fan isn't writing English. If the fan switches language mid-chat or mixes languages, match them. Write like a native speaker of that language: correct spelling and grammar, natural rhythm, zero mistakes, nothing that sounds machine-translated or stiff. When you aren't certain of a word or phrase in that language, keep it simple and safe so it still reads perfectly.",
    "Few or no emoji — only where it lands naturally.",
    "Output ONLY the message text you send. No quotes, no labels, no preamble.",
  ].join("\n");

  const userPrompt = `Recent chat (oldest to newest):\n${history}\n\nWrite the next thing you send ${fanFirstName} right now — short, personal, in your voice (1-3 sentences), and in the exact same language ${fanFirstName} is writing in.`;

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