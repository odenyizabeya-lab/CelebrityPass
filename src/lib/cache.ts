/**
 * Two-tier read cache for the expensive public catalogue queries.
 *
 * WHY THIS EXISTS
 * ---------------
 * The celebrity list is read on nearly every public render (home, catalogue,
 * platform stats). Each read is a full-table query over ~775 rows through
 * Supabase's shared transaction pooler on a ~2s-latency link. Doing that per
 * request exhausted the pooler, which then reset connections mid-render and
 * finally refused new ones (P1001) — taking the whole site down, which is what
 * users experience as "the app doesn't open".
 *
 * The previous fix was a 45s in-process Map. That hides the problem only while
 * a single process stays warm: it is lost on every deploy and every cold start,
 * it is per-instance (so a second replica re-runs the query), and an admin
 * write wipes it.
 *
 * THE TWO TIERS
 * -------------
 *   L1  in-process Map, always on, sub-millisecond, no network.
 *   L2  Upstash Redis over REST, when configured, so the cache is shared by
 *       every instance and survives restarts.
 *
 * L2 IS OPTIONAL BY DESIGN. If the Upstash env vars are absent, or Redis is
 * unreachable, or the fetch times out, every operation silently falls back to
 * L1. A cache outage must never become an application error — the worst case
 * is the old behaviour, which is slow but correct.
 */

/** Env shape, read lazily so tests/CLI scripts can still import this module. */
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** Namespace so a shared Redis instance can never collide with other keys. */
const PREFIX = "cp:read:";

const MEMORY_LIMIT = 64;

interface Entry {
  value: unknown;
  expires: number;
}

const memory = new Map<string, Entry>();
/** In-flight loaders, so a cold cache under a burst runs the query once. */
const inflight = new Map<string, Promise<unknown>>();
/** Every key this process has written, so `cacheClear` can evict them from L2. */
const knownKeys = new Set<string>();

type RedisLike = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
};

let redisPromise: Promise<RedisLike | null> | null = null;
let warnedAboutRedis = false;
/**
 * Circuit breaker. Without it, an unreachable Redis costs the full client
 * timeout on *every* read and write, which is far worse than having no L2 at
 * all — measured at 8.7s added to a cold render. After a failure we skip L2
 * entirely for a cooldown, so a cache outage costs one timeout, once.
 */
let redisDownUntil = 0;
const REDIS_COOLDOWN_MS = 30_000;
/** Hard ceiling on any single L2 call. The client retries internally, so this
 *  must be short enough that a dead cache can never dominate a page render. */
const REDIS_TIMEOUT_MS = 600;

/** Rejects after `ms` so a stalled cache call cannot outlive its usefulness. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function markRedisDown(err: unknown): void {
  redisDownUntil = Date.now() + REDIS_COOLDOWN_MS;
  if (warnedAboutRedis) return;
  warnedAboutRedis = true;
  console.warn("[cache] Redis unavailable, using in-process cache only:", (err as Error)?.message ?? err);
}

/** True when the L2 tier should be attempted at all right now. */
function redisAvailable(): boolean {
  return Date.now() >= redisDownUntil;
}

/**
 * Resolves the Redis client once per process. Dynamic import keeps the
 * dependency optional at runtime: with no env vars configured we never even
 * load it.
 */
function connectRedis(): Promise<RedisLike | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return Promise.resolve(null);
  if (redisPromise) return redisPromise;
  redisPromise = (async () => {
    try {
      const { Redis } = await import("@upstash/redis");
      return new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) as unknown as RedisLike;
    } catch {
      return null;
    }
  })();
  return redisPromise;
}

function remember(key: string, value: unknown, ttlMs: number): void {
  memory.set(key, { value, expires: Date.now() + ttlMs });
  if (memory.size > MEMORY_LIMIT) {
    // Map preserves insertion order, so the first key is the oldest write.
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  knownKeys.add(key);
}

/**
 * Reads a cached value, running `loader` on a miss.
 *
 * L1 is checked first and is intentionally authoritative for its own TTL: a
 * value just written must not be re-fetched from Redis. L2 is consulted only
 * when L1 has nothing, and any failure there degrades to calling the loader.
 */
export async function cacheRead<V>(key: string, loader: () => Promise<V>, ttlMs: number): Promise<V> {
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as V;
  if (hit) memory.delete(key);

  const existing = inflight.get(key);
  if (existing) return existing as Promise<V>;

  const promise = (async (): Promise<V> => {
    const redis = redisAvailable() ? await connectRedis() : null;
    if (redis) {
      try {
        const raw = await withTimeout(redis.get<string>(PREFIX + key), REDIS_TIMEOUT_MS, "cache get");
        if (raw) {
          const parsed = JSON.parse(raw) as { value: V; expires: number };
          // Respect the writer's expiry clock rather than trusting a stale
          // copy that outlived its TTL in another instance.
          if (parsed.expires > Date.now()) {
            remember(key, parsed.value, Math.max(1, parsed.expires - Date.now()));
            return parsed.value;
          }
          await withTimeout(redis.del(PREFIX + key), REDIS_TIMEOUT_MS, "cache del").catch(() => undefined);
        }
      } catch (err) {
        markRedisDown(err);
      }
    }

    const value = await loader();
    const expires = Date.now() + ttlMs;
    remember(key, value, ttlMs);
    if (redis) {
      try {
        await withTimeout(
          redis.set(PREFIX + key, JSON.stringify({ value, expires }), { ex: Math.ceil(ttlMs / 1000) }),
          REDIS_TIMEOUT_MS,
          "cache set",
        );
      } catch (err) {
        markRedisDown(err);
      }
    }
    return value;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

/**
 * Drops every cached read. Called after admin writes so the next request sees
 * the change instead of up to `ttl` of stale data, across every instance.
 */
export async function cacheClear(): Promise<void> {
  memory.clear();
  const keys = [...knownKeys];
  knownKeys.clear();
  inflight.clear();
  const redis = redisAvailable() ? await connectRedis() : null;
  if (!redis || keys.length === 0) return;
  try {
    // Chunked so a large key set cannot exceed a single request's URL budget.
    for (let i = 0; i < keys.length; i += 100) {
      await withTimeout(
        redis.del(...keys.slice(i, i + 100).map((k) => PREFIX + k)),
        REDIS_TIMEOUT_MS,
        "cache clear",
      );
    }
  } catch (err) {
    markRedisDown(err);
  }
}

/** True when a shared L2 cache is configured. Used by diagnostics/tests. */
export function isSharedCacheEnabled(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}
