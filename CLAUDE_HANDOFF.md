# QuoteGen — Handoff

> **This document was rewritten in June 2026.** The original handoff described the
> early single-user, localStorage-only prototype, which no longer exists.

QuoteGen is now a **multi-tenant, 100% free SaaS platform**: Next.js 16 (App
Router) + React 19 + Tailwind 4 + Prisma on Neon Postgres, with JWT auth,
per-company data isolation enforced at the Prisma-client layer, platform roles
(Super Admin / Support / Company Admin / Company User), a marketing landing page,
guided onboarding, an issue-tracking support desk, and usage analytics.

**Read [SAAS_GUIDE.md](SAAS_GUIDE.md)** for architecture, setup, environment
variables, credentials/seeding, testing, and known limitations.

Quick map:

| Area | Where |
|---|---|
| Tenant isolation | `src/lib/db.ts` (Prisma extension) + `src/lib/tenant-context.ts` + `src/lib/with-api.ts` |
| Routing/auth guards | `src/proxy.ts` (Next 16 proxy convention) |
| Marketing site | `src/app/landing/page.tsx` |
| Auth UI system | `src/components/auth/AuthShell.tsx` |
| Platform console | `src/app/admin/**`, `src/app/support/**`, `src/components/platform/PlatformShell.tsx` |
| Tests | `tests/unit/**` (DB scoping), `tests/api/**` (HTTP isolation; needs dev server) |
| DB schema changes | `prisma migrate diff` → SQL → `prisma db execute` — **never** `migrate dev` (history has drift; it would reset the live DB) |
