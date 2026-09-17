// Fan-chat AI usage tracker.
//
// The fan-chat assistant (src/lib/ai/assistant.ts) calls Google Gemini for each
// real reply. Google does NOT expose a public "remaining quota" endpoint, so we
// can't show an exact % left — but we CAN show exactly what the owner needs to
// swap the key before fans are left hanging:
//
//   • how many requests + tokens this key has consumed today (and past days),
//   • the moment the key actually hits Gemini's limit (429 RESOURCE_EXHAUSTED) —
//     flagged loudly in Admin → AI Settings so a fresh key can be pasted and the
//     swap is instant (no redeploy).
//
// Storage: a single AppSetting row ("ai.assistant.usage") — the same key/value
// table the other admin secrets use. No schema change. Counters reset each UTC
// day, and when the owner swaps to a DIFFERENT key the meter resets too, so it
// always reflects the key that is actually powering fan chat.
import { prisma } from "@/lib/db";

const USAGE_SETTING_KEY = "ai.assistant.usage";
const MAX_DAYS_TRACKED = 31;

export type UsageTokens = {
  promptTokens?: number;
  outputTokens?: number;
  thoughtsTokens?: number;
};

export type AiUsageDay = {
  day: string;
  requests: number;
  promptTokens: number;
  outputTokens: number;
  thoughtsTokens: number;
};

export type AssistantUsage = {
  keyLast4: string | null;
  today: AiUsageDay;
  history: { day: string; requests: number; totalTokens: number }[];
  quotaHits: number;
  lastQuotaAt: string | null;
  lastQuotaMessage: string | null;
};

type StoredUsage = {
  version: 1;
  keyLast4: string;
  quotaHits: number;
  lastQuotaAt: string | null;
  lastQuotaMessage: string | null;
  days: Record<string, AiUsageDay>;
};

function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD" (UTC)
}

function emptyDay(day: string): AiUsageDay {
  return { day, requests: 0, promptTokens: 0, outputTokens: 0, thoughtsTokens: 0 };
}

function parseStored(raw: string | null): StoredUsage {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredUsage;
      if (parsed && parsed.version === 1 && parsed.days) {
        return {
          version: 1,
          keyLast4: typeof parsed.keyLast4 === "string" ? parsed.keyLast4 : "",
          quotaHits: Number.isFinite(Number(parsed.quotaHits)) ? Number(parsed.quotaHits) : 0,
          lastQuotaAt: typeof parsed.lastQuotaAt === "string" ? parsed.lastQuotaAt : null,
          lastQuotaMessage: typeof parsed.lastQuotaMessage === "string" ? parsed.lastQuotaMessage : null,
          days: parsed.days,
        };
      }
    } catch {
      // corrupt row — fall through to a fresh store
    }
  }
  return { version: 1, keyLast4: "", quotaHits: 0, lastQuotaAt: null, lastQuotaMessage: null, days: {} };
}

async function readRaw(): Promise<string | null> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: USAGE_SETTING_KEY } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function writeRaw(stored: StoredUsage): Promise<void> {
  const value = JSON.stringify(stored);
  await prisma.appSetting.upsert({ where: { key: USAGE_SETTING_KEY }, create: { key: USAGE_SETTING_KEY, value }, update: { value } });
}

function pruneDays(days: Record<string, AiUsageDay>): Record<string, AiUsageDay> {
  const sorted = Object.keys(days)
    .sort()
    .slice(-MAX_DAYS_TRACKED);
  const kept: Record<string, AiUsageDay> = {};
  for (const day of sorted) kept[day] = days[day];
  return kept;
}

/**
 * Insert the counters belongs to a key; when the key changes (owner swapped to
 * a new key), the meter starts fresh so it always reflects the live key.
 */
function freshStoreFor(keyLast4: string, stored: StoredUsage): StoredUsage {
  if (keyLast4 && stored.keyLast4 && stored.keyLast4 !== keyLast4) {
    return { version: 1, keyLast4, quotaHits: 0, lastQuotaAt: null, lastQuotaMessage: null, days: {} };
  }
  return { ...stored, keyLast4: keyLast4 || stored.keyLast4 };
}

/** Record one successful/attempted Gemini call (plus its token usage, when given). */
export async function recordAssistantCall(keyLast4: string, tokens?: UsageTokens): Promise<void> {
  try {
    const raw = await readRaw();
    const stored = freshStoreFor(keyLast4, parseStored(raw));
    const day = utcDay();
    const today = stored.days[day] ?? emptyDay(day);
    today.requests += 1;
    today.promptTokens += Number(tokens?.promptTokens) || 0;
    today.outputTokens += Number(tokens?.outputTokens) || 0;
    today.thoughtsTokens += Number(tokens?.thoughtsTokens) || 0;
    stored.days = pruneDays({ ...stored.days, [day]: today });
    await writeRaw(stored);
  } catch {
    // Usage logging must never break or slow a fan reply.
  }
}

/** Mark the current key as having hit Gemini's limit (429 RESOURCE_EXHAUSTED). */
export async function recordAssistantQuotaError(keyLast4: string, message: string): Promise<void> {
  try {
    const raw = await readRaw();
    const stored = freshStoreFor(keyLast4, parseStored(raw));
    stored.quotaHits += 1;
    stored.lastQuotaAt = new Date().toISOString();
    stored.lastQuotaMessage = message.slice(0, 400);
    await writeRaw(stored);
  } catch {
    // never throw — the reply flow already fell back to human templates safely.
  }
}

/** Client-safe usage snapshot for Admin → AI Settings. */
export async function getAssistantUsage(): Promise<AssistantUsage | null> {
  try {
    const stored = parseStored(await readRaw());
    if (!stored.keyLast4 && Object.keys(stored.days).length === 0 && stored.quotaHits === 0) return null;

    const day = utcDay();
    const today = stored.days[day] ?? emptyDay(day);
    const history = Object.keys(stored.days)
      .sort((a, b) => (a < b ? 1 : -1))
      .slice(0, 7)
      .map((d) => ({
        day: d,
        requests: stored.days[d].requests,
        totalTokens: stored.days[d].promptTokens + stored.days[d].outputTokens + stored.days[d].thoughtsTokens,
      }));

    return {
      keyLast4: stored.keyLast4 || null,
      today: {
        ...today,
        requests: stored.keyLast4 ? today.requests : 0,
        promptTokens: stored.keyLast4 ? today.promptTokens : 0,
        outputTokens: stored.keyLast4 ? today.outputTokens : 0,
        thoughtsTokens: stored.keyLast4 ? today.thoughtsTokens : 0,
      },
      history,
      quotaHits: stored.keyLast4 ? stored.quotaHits : 0,
      lastQuotaAt: stored.keyLast4 ? stored.lastQuotaAt : null,
      lastQuotaMessage: stored.keyLast4 ? stored.lastQuotaMessage : null,
    };
  } catch {
    return null;
  }
}