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

// 60s cache of user emailVerified status, mirroring the company-active cache.
const userVerifiedCache = new Map<string, { verified: boolean; at: number }>();

async function isUserVerified(userId: string): Promise<boolean> {
  const cached = userVerifiedCache.get(userId);
  if (cached && Date.now() - cached.at < COMPANY_CACHE_TTL) return cached.verified;
  const user = await prismaUnscoped.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  const verified = user?.emailVerified === true;
  userVerifiedCache.set(userId, { verified, at: Date.now() });
  return verified;
}

/** Call after a user verifies their email so the gate lifts immediately. */
export function invalidateUserVerifiedCache(userId: string) {
  userVerifiedCache.delete(userId);
}

// 60s in-memory cache of company active status, so every request doesn't hit the DB.
const companyActiveCache = new Map<string, { isActive: boolean; at: number }>();
const COMPANY_CACHE_TTL = 60_000;

async function isCompanyActive(companyId: string): Promise<boolean> {
  const cached = companyActiveCache.get(companyId);
  if (cached && Date.now() - cached.at < COMPANY_CACHE_TTL) return cached.isActive;
  const company = await prismaUnscoped.company.findUnique({
    where: { id: companyId },
    select: { isActive: true },
  });
  const isActive = company?.isActive === true;
  companyActiveCache.set(companyId, { isActive, at: Date.now() });
  return isActive;
}

/** Call when a company is enabled/disabled so the change applies immediately. */
export function invalidateCompanyCache(companyId: string) {
  companyActiveCache.delete(companyId);
}

// ── Session revocation (token version) ───────────────────────────────────────
// The JWT carries a tokenVersion; every authenticated request re-checks it
// against the user's current DB value (cached 60s). Bumping the DB value
// invalidates all outstanding tokens for that user within the cache TTL.
const userTokenCache = new Map<string, { version: number; at: number }>();

async function currentTokenVersion(userId: string): Promise<number> {
  const cached = userTokenCache.get(userId);
  if (cached && Date.now() - cached.at < COMPANY_CACHE_TTL) return cached.version;
  const user = await prismaUnscoped.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true },
  });
  const version = user?.tokenVersion ?? 0;
  userTokenCache.set(userId, { version, at: Date.now() });
  return version;
}

/** Drop a single user's cached token version (call after re-issuing their token). */
export function invalidateUserTokenCache(userId: string) {
  userTokenCache.delete(userId);
}

/** Revoke every outstanding session for one user (e.g. forced sign-out, deactivate). */
export async function revokeUserSessions(userId: string): Promise<number> {
  const user = await prismaUnscoped.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
  userTokenCache.set(userId, { version: user.tokenVersion, at: Date.now() });
  return user.tokenVersion;
}

/** Revoke sessions for every user holding a given role (e.g. permissions changed). */
export async function revokeRoleSessions(roleId: string): Promise<void> {
  await prismaUnscoped.user.updateMany({
    where: { roleId },
    data: { tokenVersion: { increment: 1 } },
  });
  // Bulk bump: clear the whole cache rather than track which users were affected.
  userTokenCache.clear();
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
