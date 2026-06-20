import { NextRequest, NextResponse } from "next/server";

/**
 * Authorization gate for `/api/cron/*` routes.
 *
 * These paths are public to the edge proxy and rely on a bearer secret instead.
 * Vercel Cron automatically attaches `Authorization: Bearer <CRON_SECRET>` when
 * the `CRON_SECRET` env var is set, so the same check covers both Vercel's
 * scheduler and any external caller.
 *
 * Fails CLOSED in production: if `CRON_SECRET` is not configured we refuse to
 * run (503) rather than execute an unauthenticated — and in some cases
 * destructive (purge-deleted) — job. In development a missing secret is allowed
 * for convenience.
 *
 * @returns a response to return immediately when unauthorized, or null when OK.
 */
export function cronAuthError(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Cron is not configured" },
        { status: 503 }
      );
    }
    return null; // local dev: allow without a secret
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
