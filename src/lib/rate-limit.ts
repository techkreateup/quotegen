// Rate limiter with a distributed backend.
//
// In production on a serverless fleet, an in-memory map is per-instance, so
// limits are effectively multiplied by the number of live lambdas. When
// UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set we use a shared
// Redis fixed-window counter over Upstash's REST API (no extra dependency —
// just fetch). Without those env vars we fall back to the in-memory limiter,
// which is fine for local/single-instance use.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
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
async function redisCommand(args: (string | number)[]): Promise<unknown> {
  const res = await fetch(`${UPSTASH_URL}/${args.map((a) => encodeURIComponent(String(a))).join("/")}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    // Never let a slow/broken limiter store hang the request.
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const body = (await res.json()) as { result?: unknown };
  return body.result;
}

async function rateLimitRedis(key: string, max: number, windowMs: number): Promise<boolean> {
  const ttlSec = Math.ceil(windowMs / 1000);
  const bucket = Math.floor(Date.now() / windowMs);
  const k = `rl:${key}:${bucket}`;
  const count = Number(await redisCommand(["INCR", k]));
  if (count === 1) {
    // First hit in this window — set the expiry so the counter self-cleans.
    await redisCommand(["EXPIRE", k, ttlSec]);
  }
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
