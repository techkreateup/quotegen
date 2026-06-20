// Rate limiter with a distributed backend.
//
// In production on a serverless fleet, an in-memory map is per-instance, so
// limits are effectively multiplied by the number of live lambdas. When
// UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set we use a shared
// Redis fixed-window counter over Upstash's REST API (no extra dependency —
// just fetch). Without those env vars we fall back to the in-memory limiter,
// which is fine for local/single-instance use.

// Accept either the Upstash-native var names or the KV_* aliases that Vercel's
// Marketplace integration injects — whichever is present works with no config.
const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const useRedis = !!(UPSTASH_URL && UPSTASH_TOKEN);

// ── In-memory sliding window (fallback) ──────────────────────────────────────
const buckets = new Map<string, number[]>();

function rateLimitMemory(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

// ── Redis fixed window (Upstash REST) ────────────────────────────────────────
// One HTTP round-trip via the pipeline endpoint: INCR the window counter and
// (re)set its TTL together. Bundling EXPIRE with INCR removes the race where a
// crash between the two leaves a counter that never expires (a permanent lock).
async function rateLimitRedis(key: string, max: number, windowMs: number): Promise<boolean> {
  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
  const bucket = Math.floor(Date.now() / windowMs);
  const k = `rl:${key}:${bucket}`;
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", k],
      ["EXPIRE", k, ttlSec],
    ]),
    // Never let a slow/broken limiter store hang the request.
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  // Pipeline returns an array of { result } objects in command order.
  const body = (await res.json()) as Array<{ result?: unknown; error?: string }>;
  const incr = body?.[0];
  if (!incr || incr.error) throw new Error(`upstash incr: ${incr?.error ?? "no result"}`);
  const count = Number(incr.result ?? 0);
  return count <= max;
}

/**
 * Returns true if the call is allowed, false if the limit is exceeded.
 * Async so it can use a shared store; callers must `await`.
 * Fails OPEN (allows) if the Redis backend errors, so a limiter outage never
 * takes down auth/payment endpoints.
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  if (!useRedis) return rateLimitMemory(key, max, windowMs);
  try {
    return await rateLimitRedis(key, max, windowMs);
  } catch (err) {
    console.warn("[rate-limit] redis backend failed, allowing request:", (err as Error).message);
    return true;
  }
}

export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
