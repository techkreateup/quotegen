import { NextRequest, NextResponse } from "next/server";
import { runWithTenant } from "@/lib/tenant-context";
import { prismaUnscoped } from "@/lib/db";
import { resolveModuleFromPath } from "@/lib/permissions";
import { isModuleEnabled } from "@/lib/feature-gate";

// Generic so route param shapes ({ id }, { taskId }, ...) flow through unchanged.
type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response> | Response;

interface WithApiOptions {
  /** Allow platform staff (companyId = null) to call this route. Default: false. */
  allowPlatform?: boolean;
  /** Allow unauthenticated access (e.g. auth routes). Default: false. */
  public?: boolean;
  /** Require the caller to have a verified email. Default: false. */
  requireVerified?: boolean;
}

// ── Distributed cache via Upstash Redis (same instance as rate-limit.ts) ─────
// Falls back to in-memory Map when Redis is unavailable. All caches share a 60s
// TTL so a revoked session / disabled company propagates across the fleet fast.
const CACHE_TTL = 60_000;
const REDIS_TTL_SEC = 60;

const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const useRedis = !!(UPSTASH_URL && UPSTASH_TOKEN);

const memCache = new Map<string, { v: string; at: number }>();

async function cacheGet(key: string): Promise<string | null> {
  if (useRedis) {
    try {
      const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const body = await res.json() as { result?: string | null };
        if (body.result != null) return String(body.result);
      }
      return null;
    } catch {
      // fall through to in-memory
    }
  }
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.v;
  return null;
}

async function cacheSet(key: string, value: string): Promise<void> {
  memCache.set(key, { v: value, at: Date.now() });
  if (useRedis) {
    try {
      await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}/ex/${REDIS_TTL_SEC}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        signal: AbortSignal.timeout(2000),
      });
    } catch { /* best-effort */ }
  }
}

async function cacheDel(key: string): Promise<void> {
  memCache.delete(key);
  if (useRedis) {
    try {
      await fetch(`${UPSTASH_URL}/del/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        signal: AbortSignal.timeout(2000),
      });
    } catch { /* best-effort */ }
  }
}

async function cacheFlushPrefix(prefix: string): Promise<void> {
  for (const k of memCache.keys()) {
    if (k.startsWith(prefix)) memCache.delete(k);
  }
  // Redis keys auto-expire; bulk SCAN+DEL is overkill for rare role-revoke events.
}

// ── User verified cache ─────────────────────────────────────────────────────
async function isUserVerified(userId: string): Promise<boolean> {
  const cached = await cacheGet(`uv:${userId}`);
  if (cached !== null) return cached === "1";
  const user = await prismaUnscoped.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  const verified = user?.emailVerified === true;
  await cacheSet(`uv:${userId}`, verified ? "1" : "0");
  return verified;
}

/** Call after a user verifies their email so the gate lifts immediately. */
export function invalidateUserVerifiedCache(userId: string) {
  void cacheDel(`uv:${userId}`);
}

// ── Company active cache ────────────────────────────────────────────────────
async function isCompanyActive(companyId: string): Promise<boolean> {
  const cached = await cacheGet(`ca:${companyId}`);
  if (cached !== null) return cached === "1";
  const company = await prismaUnscoped.company.findUnique({
    where: { id: companyId },
    select: { isActive: true },
  });
  const isActive = company?.isActive === true;
  await cacheSet(`ca:${companyId}`, isActive ? "1" : "0");
  return isActive;
}

/** Call when a company is enabled/disabled so the change applies immediately. */
export function invalidateCompanyCache(companyId: string) {
  void cacheDel(`ca:${companyId}`);
  void cacheDel(`cs:${companyId}`); // subscription cache too
}

// ── Subscription period cache ───────────────────────────────────────────────
// Stored as JSON: { s: SubscriptionStatus, e: ISO date or null }. 60s TTL.
// "Expired" = subscriptionStatus is ACTIVE but currentPeriodEnd < now. TRIALING,
// FREE, PAST_DUE, CANCELED are NOT treated as expired here — they're handled by
// the subscription state machine + cron; we only need to defend against ACTIVE
// rows whose billing window lapsed without a renewal payment.
interface CachedSubscription {
  status: string;
  periodEnd: string | null;
}
async function getCachedSubscription(companyId: string): Promise<CachedSubscription | null> {
  const cached = await cacheGet(`cs:${companyId}`);
  if (cached !== null) {
    try { return JSON.parse(cached) as CachedSubscription; } catch { /* fall through */ }
  }
  const company = await prismaUnscoped.company.findUnique({
    where: { id: companyId },
    select: { subscriptionStatus: true, currentPeriodEnd: true },
  });
  if (!company) return null;
  const value: CachedSubscription = {
    status: company.subscriptionStatus,
    periodEnd: company.currentPeriodEnd?.toISOString() ?? null,
  };
  await cacheSet(`cs:${companyId}`, JSON.stringify(value));
  return value;
}

function isSubscriptionExpired(sub: CachedSubscription): boolean {
  if (sub.status !== "ACTIVE") return false;
  if (!sub.periodEnd) return false; // no window set → don't treat as expired
  return new Date(sub.periodEnd).getTime() < Date.now();
}

// Routes the user MUST be able to hit even with an expired subscription so they
// can renew, see invoices, or cancel. Read-only billing visibility is allowed.
function isBillingEscapePath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/billing") ||
    pathname.startsWith("/api/payments") ||
    pathname.startsWith("/api/plan") ||
    pathname.startsWith("/api/plans") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/settings/profile") ||
    pathname === "/api/auth/me"
  );
}

// ── Session revocation (token version) ───────────────────────────────────────
async function currentTokenVersion(userId: string): Promise<number> {
  const cached = await cacheGet(`tv:${userId}`);
  if (cached !== null) return Number(cached);
  const user = await prismaUnscoped.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true },
  });
  const version = user?.tokenVersion ?? 0;
  await cacheSet(`tv:${userId}`, String(version));
  return version;
}

/** Drop a single user's cached token version (call after re-issuing their token). */
export function invalidateUserTokenCache(userId: string) {
  void cacheDel(`tv:${userId}`);
}

/** Revoke every outstanding session for one user (e.g. forced sign-out, deactivate). */
export async function revokeUserSessions(userId: string): Promise<number> {
  const user = await prismaUnscoped.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
  await cacheSet(`tv:${userId}`, String(user.tokenVersion));
  return user.tokenVersion;
}

/** Revoke sessions for every user holding a given role (e.g. permissions changed). */
export async function revokeRoleSessions(roleId: string): Promise<void> {
  await prismaUnscoped.user.updateMany({
    where: { roleId },
    data: { tokenVersion: { increment: 1 } },
  });
  await cacheFlushPrefix("tv:");
}

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF / cross-origin defense for state-changing requests.
 * Browsers always attach an Origin header on cross-origin (and same-site POST)
 * requests, so we reject when a present Origin does not match the request host
 * (or the configured ALLOWED_ORIGIN). A missing Origin is allowed — that covers
 * legitimate non-browser callers (curl, server-to-server) which can't be tricked
 * via a victim's cookies. Only enforced in production.
 */
function originAllowed(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (!STATE_CHANGING.has(req.method)) return true;

  const origin = req.headers.get("origin");
  if (!origin) return true; // not a browser cross-site request

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false; // malformed Origin
  }

  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed) {
    try {
      if (originHost === new URL(allowed).host) return true;
    } catch { /* fall through to host check */ }
  }

  // Same-origin: Origin host must match the host the request was sent to.
  const requestHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return originHost === requestHost;
}

/**
 * Wraps an API route handler with tenant context + standard error handling.
 * Reads identity headers set by middleware and runs the handler inside
 * AsyncLocalStorage so the scoped Prisma client auto-filters by companyId.
 */
export function withApi<C = { params: Promise<Record<string, string>> }>(
  handler: Handler<C>,
  opts: WithApiOptions = {}
) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      if (!opts.public && !originAllowed(req)) {
        return NextResponse.json(
          { error: "Cross-origin request rejected" },
          { status: 403 }
        );
      }

      const userId = req.headers.get("x-user-id");
      const companyId = req.headers.get("x-company-id") || null;

      if (!userId && !opts.public) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      if (companyId === null && !opts.allowPlatform && !opts.public) {
        return NextResponse.json(
          { error: "This resource requires a company account" },
          { status: 403 }
        );
      }

      // Session revocation: reject tokens whose version no longer matches the
      // user's current DB value. Legacy tokens issued before this field existed
      // carry no version (empty header) and are skipped until they expire (24h).
      const tokenVersionHeader = req.headers.get("x-token-version");
      if (userId && tokenVersionHeader && tokenVersionHeader !== "undefined") {
        const claimed = Number(tokenVersionHeader);
        if (Number.isFinite(claimed) && claimed !== (await currentTokenVersion(userId))) {
          return NextResponse.json(
            { error: "Your session has expired. Please sign in again.", sessionRevoked: true },
            { status: 401 }
          );
        }
      }

      if (companyId && !(await isCompanyActive(companyId))) {
        return NextResponse.json(
          { error: "This company account has been disabled. Contact support." },
          { status: 403 }
        );
      }

      // Subscription window gate: an ACTIVE subscription whose billing window
      // has lapsed must not silently keep working. The cron normally transitions
      // these to PAST_DUE within 24h, but we don't want users to keep using paid
      // features in the gap. Billing/auth routes stay open so they can renew.
      if (companyId && !isBillingEscapePath(req.nextUrl.pathname)) {
        const sub = await getCachedSubscription(companyId);
        if (sub && isSubscriptionExpired(sub)) {
          return NextResponse.json(
            { error: "Your subscription has expired. Renew at /billing to continue.", subscriptionExpired: true },
            { status: 402 }
          );
        }
      }

      if (opts.requireVerified && userId && !(await isUserVerified(userId))) {
        return NextResponse.json(
          { error: "Please verify your email address to perform this action." },
          { status: 403 }
        );
      }

      // Feature gating: if the route maps to a feature-flagged module and the
      // Super Admin has disabled that feature for this company, block it.
      if (companyId) {
        const mod = resolveModuleFromPath(req.nextUrl.pathname);
        if (mod && !(await isModuleEnabled(companyId, mod))) {
          return NextResponse.json(
            { error: "This feature is not enabled for your plan. Contact your administrator." },
            { status: 403 }
          );
        }
      }

      return await runWithTenant({ companyId, userId }, () => handler(req, ctx));
    } catch (err: unknown) {
      // Log the full detail server-side, but never return internal messages
      // (Prisma internals, "Tenant context missing", etc.) to the client.
      console.error(`${req.method} ${req.nextUrl.pathname} error:`, err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
