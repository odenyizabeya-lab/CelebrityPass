import { prisma } from "@/lib/db";

/**
 * Per-conversation AI memory.
 *
 * The assistant keeps a small running note on `dialog.aiMemory` about each fan
 * so it can remember, across the whole conversation (and between sessions),
 * everything important they talked about: money worries, wishes to meet, love
 * and marriage talk, family, favorite things, names, rituals, promises. The
 * ram is injected into replies and lets sweet, convincing, romantic chat build
 * on what really happened before instead of starting cold every message.
 *
 * IMPORTANT PRIVACY BOUNDARY: only WHAT IS WRITTEN IN THE CHAT is remembered —
 * never fan emails, phones, addresses or payment details. Never pass anything
 * outside this chat into the note.
 */

const MAX_NOTE = 6000;

/** Recent fan messages, newest-last, oldest-first ordering is handled by caller. */
export async function loadAiMemory(conversationId: string): Promise<string> {
  try {
    const conv = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { aiMemory: true },
    });
    return conv?.aiMemory?.trim() ?? "";
  } catch {
    return "";
  }
}

/** Keep the note within MAX_NOTE while preserving the newest tail. */
function clamp(note: string): string {
  if (note.length <= MAX_NOTE) return note;
  return note.slice(note.length - MAX_NOTE);
}

/** Shorten a line that is genuinely useful but not worth its length. */
function shorten(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Pull the genuinely-memorable bits out of one plain-text fan message. This is a
 * lightweight, deterministic pass — no model calls — so memory still works when
 * Gemini is rate-limited or offline. Returns metaline strings.
 */
function extractFacts(body: string): string[] {
  const s = body.trim();
  if (!s || s.length > 4000) return [];
  const out: string[] = [];
  const low = s.toLowerCase();

  const push = (label: string, value: string) => {
    const v = shorten(value.replace(/\s+/g, " ").trim(), 240);
    if (v && !out.some((x) => x.includes(v))) out.push(`${label}: ${v}`);
  };

  if (/(no money|no cash|no funds|can'?t afford|can'?t pay|cannot afford|broke|too expensive|expensive|scarce|hardship|trouble paying|small small|instalment|installment|pay later|smaller amount|don't have (the )?money|i don't have|money is tight|tight on money|financial|fc\b)/i.test(s)) {
    push("Money struggle (important — sweetly convince, lower to the entry level, no instalment promises)", s);
  }
  if (/\b(fc|full? card|celebritypass|celebrity pass|membership|card|paying|payment|price|cost|fee)\b/i.test(s)) {
    push("Money/card/membership talk", s);
  }
  if (/(visit|meet (you|u)|come (and )?(see|to)|see you|when (can|will) (i|we)|location|country|city|travel|flight|\bhometown\b|\blatvia\b|\bethiopia\b|\bnigeria\b|\bghana\b|\bkenya\b|\buganda\b|\bsouth africa\b)/i.test(low)) {
    push("Wants to meet/visit (give hope + plan after the card)", s);
  }
  if (/(i (love|adore|like) you|in love|marry|marriage|wife|husband|girlfriend|boyfriend|date|dating|relationship|will you|be mine|my love|darling|sweetheart|baby|propose)/i.test(low)) {
    push("Love/marriage talk (reciprocate sweetly + romantically)", s);
  }
  if (/(my (mom|mum|mother|dad|father|son|daughter|brother|sister|family|wife|husband|girlfriend|boyfriend|friend|best friend|child|children)|my baby|my kid)/i.test(low)) {
    push("Family mention (remember their family)", s);
  }
  if (/my (birthday|age|job|work|business|school|health|name is|name's)|i'?m (a )?(student|teacher|doctor|nurse|driver|farmer|trader|singer|artist|musician|football|entrepreneur|business)/i.test(low)) {
    push("Personal detail", s);
  }
  if (/\b(food|dish|meal|eat|rice|jollof|banku|ugali|plantain|tea|coffee|favorite|favourite)\b/i.test(low)) {
    push("Food/taste mention", s);
  }
  if (/(next week|tomorrow|tonight|today|later|soon|i'?ll|promise|deal|bet)/i.test(low)) {
    push("Plan/promise mention", s);
  }
  if (/(sad|lonely|depressed|stress|worried|scared|afraid|tired|pain|cry|hurt|missing you|miss you)/i.test(low)) {
    push("Feeling raw, emotional (comfort + keep them close)", s);
  }
  if (/(scam|scammer|fake|fraud|robot|bot|ai\b|is (this|this chat|you) (real|fake))/i.test(low)) {
    push("Asked if the chat is real/a scam (already reassured — stay warm + real)", s);
  }
  if (/(fc|celebritypass|celebrity pass).*(what|why|how|worth)|(what|why|how).*(fc|celebritypass|celebrity pass)/i.test(low)) {
    push("Asked about getting the CelebrityPass card", s);
  }

  // Any other short message is kept at a low level so the AI can text like it
  // actually remembers talking to them (never full transcripts, just hooks).
  if (!out.length) push("Talked about", s);

  return out.slice(0, 5);
}

export type MemoryWrite = {
  conversationId: string;
  celebrityName: string;
  memory: string;
};

/**
 * Save the assistant's memory for one conversation. Reads whatever already
 * exists, appends new memorable facts from the latest fan message that are not
 * already in the note, and stores the clamped merged note. Never blocks long:
 * a small pure-DB operation, so it is safe to run fire-and-forget.
 */
export async function rememberConversation(opts: {
  conversationId: string;
  latestFanText: string;
}): Promise<void> {
  const facts = extractFacts(opts.latestFanText);
  if (!facts.length) return;

  const existing = await loadAiMemory(opts.conversationId);
  const missing = facts.filter(
    (f) => !existing.toLowerCase().includes(f.split(":")[0].toLowerCase()) && !existing.includes(f),
  );
  if (!missing.length) return;

  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const entry = `[${stamp}] ${missing.join(" | ")}`;
  const note = clamp(existing ? `${existing}\n${entry}` : entry);

  try {
    await prisma.chatConversation.update({
      where: { id: opts.conversationId },
      data: { aiMemory: note },
    });
  } catch {
    // Memory is best-effort — a chat that fails to save memory still works.
  }
}

/**
 * Async fire-and-forget wrapper used by the message route so saving memory
 * never slows the fan's send-ack (the delivered tick).
 */
export function rememberAsync(opts: {
  conversationId: string;
  latestFanText: string;
}): void {
  void rememberConversation(opts).catch(() => {});
}