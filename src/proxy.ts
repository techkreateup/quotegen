import { NextRequest, NextResponse } from "next/server";
import { verifyJwtEdge, type JwtPayload } from "@/lib/auth-edge";
import { resolveModuleFromPath, httpMethodToAction, hasPermission } from "@/lib/permissions";
import type { Permissions } from "@/lib/permissions";

const PUBLIC_PATHS = [
  "/landing",
  "/demo",
  "/features",
  "/solutions",
  "/security",
  "/pricing",
  "/login",
  "/signup",
  "/forgot-password",
  "/terms",
  "/privacy",
  "/support/new",
  "/api/support/tickets",
  "/api/public",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/forgot-password",
  "/api/plans/public",
  "/api/webhooks",
  "/api/cron",
  // UploadThing presign + signed server callback. The route authenticates the
  // user from the JWT cookie itself (see src/lib/uploadthing.ts) since the proxy
  // doesn't forward identity headers to public paths, and the callback is a
  // server→server request with no cookie.
  "/api/uploadthing",
  // Public unsubscribe landing (DPDP). Token is HMAC-signed; verification lives
  // in the page itself (src/app/u/[token]/page.tsx).
  "/u",
  "/p",
  "/api/proxy-image",
];

const ALWAYS_ALLOWED_PATHS = [
  "/api/auth/",
  "/api/notifications",
  "/api/search",
  "/api/notes",
  "/api/activity",
  "/api/issues",
  "/api/onboarding",
  // Personal profile (avatar) — every signed-in user manages their own, so it's
  // not gated to the "settings" permission module.
  "/settings/profile",
  "/api/settings/profile",
  // Document Vault is available to all company users; access is governed by the
  // plan FEATURE flag (enforced in withApi), not the per-user permission matrix.
  "/api/documents",
];

function isPlatformStaff(payload: JwtPayload): boolean {
  return payload.platformRole === "SUPER_ADMIN" || payload.platformRole === "SUPPORT";
}

function withUserHeaders(request: NextRequest, payload: JwtPayload): NextResponse {
  const headers = new Headers(request.headers);
  headers.set("x-user-id", payload.userId);
  headers.set("x-user-role", payload.role);
  headers.set("x-user-email", payload.email);
  headers.set("x-user-name", payload.name);
  headers.set("x-user-role-name", payload.roleName || "");
  headers.set("x-user-role-id", payload.roleId || "");
  headers.set("x-user-system-admin", String(!!payload.isSystemAdmin));
  headers.set("x-user-permissions", JSON.stringify(payload.permissions || {}));
  headers.set("x-company-id", payload.companyId || "");
  headers.set("x-platform-role", payload.platformRole || "COMPANY_USER");
  // Empty for legacy tokens minted before tokenVersion existed (withApi skips the
  // revocation check when this is empty).
  headers.set("x-token-version", payload.tokenVersion != null ? String(payload.tokenVersion) : "");
  return NextResponse.next({ request: { headers } });
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/uploads") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg")
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("qg_token")?.value;
  if (!token) {
    // Reset-password supports the public token flow (?token=...)
    if (pathname === "/reset-password" && request.nextUrl.searchParams.has("token")) {
      return NextResponse.next();
    }
    if (pathname === "/api/auth/reset-password") {
      return NextResponse.next(); // route validates token itself
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    // Logged-out visitors hitting the app root see the marketing site
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/landing", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = await verifyJwtEdge(token);
  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("qg_token");
    return response;
  }

  if (pathname.startsWith("/api/auth/")) {
    return withUserHeaders(request, payload);
  }

  // Force password reset redirect
  if (payload.mustResetPassword && pathname !== "/reset-password" && !pathname.startsWith("/api/auth/")) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Password reset required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/reset-password", request.url));
  }

  // ToS gate: grandfathered company users who never accepted must do so first.
  // Platform staff (super admin / support) are internal and exempt — ToS is a
  // tenant-customer concept, and gating them would loop with the staff redirect.
  // Allow auth routes, accept-terms page, and the accept-tos API through.
  //
  // Password-reset takes priority: a user who is BOTH force-reset and has not
  // accepted ToS must reset first. Without the `!mustResetPassword` guard the two
  // gates bounce forever (/reset-password → /accept-terms → /reset-password …),
  // which the browser surfaces as ERR_TOO_MANY_REDIRECTS. This is the exact state
  // of every newly-invited employee (temp password + never accepted ToS).
  if (
    !payload.tosAccepted &&
    !payload.mustResetPassword &&
    !isPlatformStaff(payload) &&
    pathname !== "/accept-terms" &&
    !pathname.startsWith("/api/auth/") &&
    !pathname.startsWith("/api/plan")
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Terms of Service acceptance required", tosRequired: true },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/accept-terms", request.url));
  }

  // ── Platform area guards ────────────────────────────────────────────────
  const wantsAdmin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
  const wantsSupport = pathname === "/support" || pathname.startsWith("/support/") || pathname.startsWith("/api/support/");

  if (wantsAdmin && payload.platformRole !== "SUPER_ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (wantsSupport && !isPlatformStaff(payload)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Support access required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (wantsAdmin || wantsSupport) {
    return withUserHeaders(request, payload);
  }

  // Platform staff have no company workspace — send them to their own area.
  if (isPlatformStaff(payload) && !pathname.startsWith("/api/")) {
    const home = payload.platformRole === "SUPER_ADMIN" ? "/admin" : "/support";
    return NextResponse.redirect(new URL(home, request.url));
  }
  if (isPlatformStaff(payload) && pathname.startsWith("/api/")) {
    // Platform staff may only use /api/admin, /api/support, /api/auth (handled above)
    return NextResponse.json(
      { error: "Platform staff cannot access company APIs" },
      { status: 403 }
    );
  }

  // Allow paths that don't need permission checks
  if (ALWAYS_ALLOWED_PATHS.some((p) => pathname.startsWith(p))) {
    return withUserHeaders(request, payload);
  }

  // Dashboard (root) and onboarding are accessible to all company users
  if (pathname === "/" || pathname === "/onboarding" || pathname === "/help" || pathname.startsWith("/help/")) {
    return withUserHeaders(request, payload);
  }

  // Dynamic permission checking
  const permissions = payload.permissions as Permissions | undefined;
  const mod = resolveModuleFromPath(pathname);

  if (mod) {
    const method = request.method;
    const action = httpMethodToAction(method);

    if (!payload.isSystemAdmin && !hasPermission(permissions, mod, action)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "You do not have permission to perform this action" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return withUserHeaders(request, payload);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
