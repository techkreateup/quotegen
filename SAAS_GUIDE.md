# QuoteGen — Multi-Tenant SaaS Guide

QuoteGen is a **100% free** multi-tenant GST billing platform. Each company gets
an isolated workspace; a platform layer (Super Admin + Support) manages the SaaS
business. Logged-out visitors see the marketing site at `/landing` (the app root
`/` redirects there); signup, login, password reset, and onboarding use a shared
enterprise split-screen design (`src/components/auth/AuthShell.tsx`).

## Architecture

### Tenant isolation (the important part)

- Every tenant table carries a `companyId` column (see `prisma/schema.prisma`).
- [src/lib/db.ts](src/lib/db.ts) wraps Prisma with a client extension that
  **automatically** filters every read and stamps every write with the
  `companyId` from the current request context (AsyncLocalStorage, set up by
  `withApi` in [src/lib/with-api.ts](src/lib/with-api.ts)).
- **Deny by default**: querying a tenant model with no tenant context throws.
  A spoofed `companyId` in a request body is overwritten by the extension.
- Cross-company access is only possible through the explicit `prismaUnscoped`
  export — used by signup, login, the platform APIs (`/api/admin/**`,
  `/api/support/**`), seeds, and scripts. Grep for `prismaUnscoped` to audit.

### Roles

| Role | Scope | Access |
|---|---|---|
| `SUPER_ADMIN` | platform | `/admin` + `/support`, manages companies & support team |
| `SUPPORT` | platform | `/support`, companies overview + issue queue (no financial data) |
| `COMPANY_ADMIN` | one company | full workspace + Settings → Users/Roles |
| `COMPANY_USER` | one company | per-module permissions via the existing UserRole matrix |

Platform roles live in the JWT (`platformRole`, `companyId`) and are enforced in
[src/proxy.ts](src/proxy.ts) (Next.js 16's replacement for the deprecated
`middleware.ts` convention). Within a company, the original module/action
permission matrix (`src/lib/permissions.ts`) still applies.

### Document numbering

Per-company and race-safe: `nextDocNumber()` ([src/lib/numbering.ts](src/lib/numbering.ts))
atomically increments the counter on `CompanySettings` inside the same
transaction that creates the document.

## Setup

```bash
npm install
npx prisma generate
npm run dev
```

`.env` (never commit):

```
DATABASE_URL=postgres://...        # pooled Neon URL
DIRECT_URL=postgres://...          # direct Neon URL (migrations)
JWT_SECRET=<long random string>    # REQUIRED in production (app refuses to boot without it)
RESEND_API_KEY=re_...              # email (forgot password); without it, links log to console
EMAIL_FROM="QuoteGen <onboarding@resend.dev>"
APP_URL=https://yourdomain.com     # used in emailed links
SUPER_ADMIN_EMAIL=you@example.com  # optional, used by seed
SUPER_ADMIN_PASSWORD=...           # optional, used by seed
```

### Create the first Super Admin

```bash
npx tsx prisma/seed.ts
```

Defaults to `superadmin@quotegen.local` / `SuperAdmin@123` — **change this
immediately** (or set `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` first).
Super admins log in at `/login` and are redirected to `/admin`.

### Onboard a new company

Nothing to do — it's self-service: `/signup` creates the company, its
settings, default Admin/Employee roles, the Company Admin account, and starts
the guided onboarding at `/onboarding` (company profile → invite team →
feature checklist; skippable and resumable from a dashboard banner).

### Support workflow

1. Company users report issues at **Help & Support** (`/help/issues`).
2. Support staff (created by the Super Admin at `/admin/support-users`) work
   the queue at `/support/issues`: filter by status/priority/company/assignee,
   assign, set status (OPEN → IN_PROGRESS → RESOLVED → CLOSED), and comment.
   "Internal note" comments are never shown to the customer.
3. `/support` lists all companies with onboarding status and admin contact.
4. Super Admin can additionally enable/disable companies at `/admin`
   (disabled companies are locked out at login and on every API call) and see
   usage analytics (signups, active users, feature usage, onboarding rate).

## Testing

```bash
npm test                # all suites
npx vitest run tests/unit       # DB-level scoping + numbering (hits the real DB with throwaway companies)
npx vitest run tests/api        # HTTP-level isolation; requires `npm run dev` running
```

Quality gates: `npx tsc --noEmit`, `npm run lint`, `npm run build` — all green.

## Known limitations

- Rate limiting and the company-active cache are in-memory — fine for one
  instance; move to Redis if you scale horizontally.
- The product is free — there is no billing system by design. `Company.plan` is
  always "Free"; `Company.isActive` is the only access gate.
- Resend uses the shared `onboarding@resend.dev` sender until you verify your
  own domain in Resend.
- Team invites are emailed via Resend (with the temp password shown on screen as
  a fallback); invited users must reset their password on first login.
- The legacy company (`cmp_legacy`, slug `legacy`) holds all pre-migration
  data. A JSON backup from before the migration is in `backups/` (git-ignored).
- `prisma/migrations` history predates the multi-tenant change; the schema was
  applied via a reviewed SQL script (`prisma/tenant-migration.sql`). Use
  `prisma migrate diff` before future schema changes.
