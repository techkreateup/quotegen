# LEARNING.md — Engineering Playbook & Issue/Solution Log

## What this file is

This is a **portable engineering knowledge base** distilled from building **QuoteGen**, a
multi-tenant SaaS (GST billing/business-suite) on **Next.js 16 (App Router, Turbopack) +
Prisma + Neon Postgres + Vercel + Razorpay**, from first commit to a live, hardened,
domain-connected production deployment.

It is written to be **handed to an AI agent (or a new engineer) at the start of a new
project**: *"Read LEARNING.md and apply these patterns and avoid these traps."* Every
entry follows the same shape:

> **Symptom → Root cause → Solution → Why this method → Reusable rule.**

It is deliberately opinionated. Each "Reusable rule" is the one-line takeaway worth
carrying into the next project. The goal is not to document *what QuoteGen is*, but to
encode *how to think* about the same class of problems so they're solved once, not twice.

> **How to use it:** skim the **Reusable Rules Cheat-Sheet** (end of file) first. When you
> hit a specific problem (deployment, DB latency, auth, money, rate limiting), jump to the
> matching section for the full story and the "why".

---

## Table of contents

1. [Stack & high-level architecture](#1-stack--high-level-architecture)
2. [Foundational methodology (the meta-rules)](#2-foundational-methodology-the-meta-rules)
3. [Architecture decisions & why](#3-architecture-decisions--why)
4. [The issue/solution log (chronological)](#4-the-issuesolution-log-chronological)
5. [Deployment war stories (the expensive lessons)](#5-deployment-war-stories-the-expensive-lessons)
6. [Security playbook](#6-security-playbook)
7. [Performance playbook](#7-performance-playbook)
8. [Debugging methodology](#8-debugging-methodology)
9. [Reusable rules cheat-sheet](#9-reusable-rules-cheat-sheet)

---

## 1. Stack & high-level architecture

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router (Turbopack) | One codebase for UI + API routes + edge middleware |
| DB | Neon Postgres (serverless, pooled) | Serverless-friendly, branching, scale-to-zero |
| ORM | Prisma | Type-safe, parameterized queries (injection-safe by default) |
| Auth | JWT via `jose` (Edge-compatible) + bcrypt | `jose` works in edge middleware; bcrypt cost-12 for passwords |
| Hosting | Vercel | Native Next.js, serverless functions, cron, WAF |
| Payments | Razorpay | India + GST invoicing |
| Rate-limit store | Upstash Redis (REST) | Serverless HTTP (no TCP pool), shared across the fleet |
| Errors | Sentry | DSN-guarded, no-ops when unset |

**Request lifecycle:** `Edge middleware (proxy.ts)` → verifies JWT, sets identity headers,
does routing/RBAC/ToS gates → `withApi()` wrapper → sets tenant context (AsyncLocalStorage),
re-checks session/company/feature → `route handler` → scoped Prisma client auto-filters by
`companyId`.

---

## 2. Foundational methodology (the meta-rules)

These shaped *how* the project was built and are the highest-leverage things to copy.

### 2.1 Sprint-checklist + persistent memory
Work was organized as numbered sprints in a `SPRINT.md` checklist (`[ ]`/`[x]`), and a
persistent **memory** captured each phase's decisions. **Why:** long projects span many
sessions; a checklist + memory means any session can resume with zero context loss and no
re-litigating settled decisions.
> **Rule:** Keep a living checklist and a decisions log. State *why*, not just *what*.

### 2.2 Verify every change three ways
After each change: `tsc --noEmit` (types) → `next build` (build) → **live round-trip**
(curl/browser against the running app). Never trust "it compiles" as "it works".
> **Rule:** Type-check, build, AND exercise the real endpoint. Compilation ≠ correctness.

### 2.3 Fail-open vs fail-closed is a deliberate choice
- **Infra niceties (rate limiter, Redis, Sentry, WhatsApp, email):** **fail OPEN** — if the
  dependency is down, allow the request / no-op. A limiter outage must never take down login.
- **Security gates (cron auth, tenant isolation, payment verification):** **fail CLOSED** —
  if misconfigured, refuse (503/403), never run unauthenticated.
> **Rule:** Decide fail-open vs fail-closed *per dependency*, based on "what's worse: blocking a
> legit user, or allowing an attacker?"

### 2.4 Server-authoritative for anything that matters (money, permissions, identity)
Never trust client-sent amounts, plan IDs, companyId, or roles. Recompute on the server.
> **Rule:** The client proposes; the server decides. Especially for money.

### 2.5 Default-ON for backwards compatibility
Feature flags used `overrides[key] !== false` (default-on), so adding a flag never broke
existing tenants. Same spirit: grandfather existing users (e.g. mark them email-verified).
> **Rule:** New gates default to permissive for existing data; opt *out*, not *in*.

---

## 3. Architecture decisions & why

### 3.1 Multi-tenant isolation: AsyncLocalStorage + Prisma `$extends` (deny-by-default)
**Decision:** Every tenant table carries `companyId`. `src/lib/db.ts` wraps Prisma with a
client extension that, for models in a `TENANT_MODELS` set, **auto-injects** `companyId`
(from AsyncLocalStorage request context) on every read and **stamps/overwrites** it on every
write — and **throws if there is no tenant context**. Cross-tenant access is only possible via
an explicit `prismaUnscoped` client (used by signup, login, platform `/admin` routes, crons).

**Why this method:** The alternative — remembering to add `where: { companyId }` on every
query — fails the first time someone forgets. That single missed clause leaks another
customer's data. Deny-by-default moves the guarantee from *discipline* to *architecture*: a
context-less query throws instead of returning everything, and a spoofed `companyId` in a
request body is overwritten.
> **Rule:** For multi-tenant, enforce isolation at the data-access layer, not in each query.
> Make the unsafe path (cross-tenant) explicit and greppable (`prismaUnscoped`).

### 3.2 Edge middleware as the single auth/routing choke point
All auth, RBAC, ToS gating, and platform-area guards live in one edge middleware
(`proxy.ts`). It verifies the JWT once and forwards identity as `x-user-*` headers.
**Why:** one place to reason about "who can reach what". Route handlers trust the headers.
> **Rule:** Centralize auth/routing in one choke point; don't scatter `if (role===...)` checks.

### 3.3 `withApi()` wrapper for every tenant API route
A single higher-order wrapper sets tenant context and runs cross-cutting checks (session
revocation, company-active, email-verified, feature-gate) before the handler.
**Debugging corollary that bit us:** *login is a plain route (no `withApi`)*, so when login
worked but everything else hung, that narrowed the bug to `withApi`/the DB layer instantly.
> **Rule:** Wrap routes in one composable middleware; keep auth/bootstrap routes deliberately
> thin so they're a control group when debugging.

### 3.4 Migrate-diff-only (never `migrate dev` on a live/drifted DB)
The DB had migration drift (early `db push` usage). **Rule adopted:** generate SQL with
`prisma migrate diff`, review it, apply with `prisma db execute`. **Never `prisma migrate
dev`** — it would reset/wipe the live Neon database.
> **Rule:** On any shared/live DB with drift, treat `migrate dev` as destructive. Diff → review
> → execute. Keep the schema file in sync so the client types match.

---

## 4. The issue/solution log (chronological)

### Phase 0 — Static export couldn't do auth/DB
- **Symptom:** Needed server-side auth + a real database; app was a static export.
- **Cause:** `output: "export"` in `next.config.ts` forces a fully static build (no server).
- **Solution:** Removed `output: "export"` → server mode; added Prisma/Neon + JWT(`jose`).
- **Why `jose`:** it runs in the Edge runtime (middleware); `jsonwebtoken` does not.
> **Rule:** If you need server logic, you're not a static export. Pick an edge-compatible JWT lib.

### Build infra — C: drive full broke npm
- **Symptom:** npm installs failing; disk at 0 bytes.
- **Solution:** Redirect caches/temp to a drive with space:
  `npm_config_cache=/e/npm-cache TMPDIR=/e/tmp TEMP=/e/tmp TMP=/e/tmp npm ...`
> **Rule:** When tooling fails inexplicably, check disk space before logic.

### Prisma dev cache — new columns read as `undefined`
- **Symptom:** After applying a column migration, the app read the new field as undefined.
- **Cause:** The running `next dev` server holds the **old Prisma client in memory**.
- **Solution:** Restart the dev server after a schema/column migration.
> **Rule:** A code-gen client cached in a long-running process is stale until restart.

### Billing — trusting client-sent amounts
- **Symptom:** Risk of a user paying ₹1 for a ₹999 plan by editing the request.
- **Solution:** `create-order` ignores the client `amount`, looks up `planDef.priceInPaise`
  server-side, and rejects `comingSoon` plans. Razorpay signatures verified with HMAC-SHA256
  using **timing-safe comparison**; webhook secret separate from key secret.
> **Rule:** Compute charges server-side. Verify payment signatures with timing-safe compare.

### Subscriptions — undefined lifecycle
- **Solution:** Explicit state machine (`transitionSubscription`/`canTransition`) with a
  7-day grace window; a daily cron does `TRIALING→FREE` on expiry, `PAST_DUE→CANCELED` past
  grace. Proration is **upgrades-only, credit-unused**, computed server-side.
> **Rule:** Model subscription state explicitly; never infer "are they paid?" ad hoc.

### Naming collision — two "SubscriptionPayment" concepts
- **Cause:** The app already had an in-app vendor `SubscriptionPayment`; SaaS billing needed
  its own. Reusing the name/route would have feature-gated the billing flow by accident.
- **Solution:** Named the SaaS model `BillingPayment` and put SaaS billing under
  `/api/billing/*`, distinct from the feature-gated `/api/subscriptions/*`.
> **Rule:** Watch for domain-term collisions between "your product" and "your SaaS business".

---

## 5. Deployment war stories (the expensive lessons)

These are the highest-value entries — each cost real debugging time on the live deploy.

### 5.1 🔴 Prisma's new `prisma-client` generator + Turbopack = broken on Vercel
- **Symptom:** App built and deployed fine; **every database call 500'd** in production with
  `PrismaClientInitializationError: could not locate the Query Engine for "rhel-openssl-3.0.x"`.
- **Root cause:** The project used Prisma's **new `prisma-client` generator** with a custom
  output path (`src/generated/prisma`). That generated client runs
  `globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))`. **Turbopack bundles
  the client into `.next/server/chunks/`**, so `import.meta.url` resolves to the *chunk*, and
  Prisma computes the query-engine path relative to the wrong directory.
- **What did NOT work:** `binaryTargets`, `outputFileTracingIncludes` (the binary may get
  traced, but the *path computation* is still wrong); `engine: "wasm"` (not a valid option in
  this Prisma version, broke the build).
- **Solution:** Reverted to the **classic `prisma-client-js` generator** (outputs to
  `node_modules/@prisma/client`, which Next.js **auto-externalizes** via
  `serverExternalPackages` — it is never bundled, so `__dirname` stays correct). Updated the
  handful of imports from `@/generated/prisma/*` to `@prisma/client`.
- **Why this method:** `@prisma/client` is on Next's built-in external list, so the engine
  resolution Just Works on serverless with zero tracing hacks. The "new" generator's ESM
  `import.meta.url` trick is fundamentally incompatible with bundler relocation.
> **Rule:** On Next.js + Vercel, use the classic `prisma-client-js` generator (node_modules
> output) + `serverExternalPackages: ['@prisma/client']`. Avoid custom-output ESM clients with
> Turbopack. If you see "could not locate the Query Engine", it's a bundling/externalization
> problem, not a missing binary.

### 5.2 🔴 Neon pooler without `pgbouncer=true` → routes hang under concurrency
- **Symptom:** Login worked, but `/api/auth/accept-tos` (and others) **hung "forever"** once
  the app fired several parallel API calls on page load.
- **Root cause:** `DATABASE_URL` pointed at Neon's **pooler** host (PgBouncer, transaction
  mode) but **lacked `pgbouncer=true`**. Prisma's default prepared statements are incompatible
  with PgBouncer transaction pooling → intermittent hangs/errors under concurrency. (Login
  *worked* because it's a plain route doing fewer queries; `withApi` routes do 3–4.)
- **Solution:** Enforce the flag **in code** so a misconfigured env var can't reintroduce it.
  In `db.ts`, when the URL targets a `-pooler` host, append `pgbouncer=true` (+ a small
  `connection_limit`) via Prisma's `datasourceUrl`.
- **Why in code, not just env:** the env var is easy to set wrong (the deployed one only had
  `sslmode=require`). Belt-and-suspenders: the code guarantees correctness regardless.
> **Rule:** Neon pooled URL **must** carry `pgbouncer=true`. Enforce it in code. "Works once
> then hangs under load" = connection-pool/prepared-statement mismatch.

### 5.3 🔴 Functions in the wrong region → 10× latency
- **Symptom:** Authenticated endpoints took **3–12 seconds** (analytics 12s). Felt like "lazy
  loading".
- **Root cause:** Vercel functions ran in **`iad1` (US East)** while the Neon DB is in
  **`ap-southeast-1` (Singapore)**. Every query crossed the Pacific (~230ms RTT) and `withApi`
  makes 3+ queries per request → ~1s of pure network before any work.
- **Solution:** Pinned functions to the DB's region: `"regions": ["sin1"]` in `vercel.json`.
  Heavy endpoints dropped to **0.6–0.9s** (analytics 12s → 0.66s). Bonus: Singapore is also
  closer to the India-based users.
- **Why:** Cross-region DB round-trips dominate serverless latency. Co-location is the single
  biggest, cheapest win.
> **Rule:** Co-locate serverless functions with the database region. Check both regions before
> blaming the code for slowness.

### 5.4 🟠 Cron endpoints publicly triggerable (fail-open auth)
- **Symptom:** `/api/cron/*` (incl. `purge-deleted`, which **permanently deletes data**) were
  reachable by anyone.
- **Root cause:** The proxy marks `/api/cron` public (relying on a bearer secret), but the
  route code was `if (secret) { check }` — so when `CRON_SECRET` was **unset**, the check was
  **skipped entirely** (fail-open on a security gate).
- **Solution:** Shared `cronAuthError()` that **fails closed**: 503 in production when no
  secret is configured, 401 on a bad/missing bearer. Set `CRON_SECRET` in Vercel (Vercel Cron
  auto-attaches it as `Authorization: Bearer <secret>`).
> **Rule:** Security gates must fail CLOSED. `if (secret) check` is a hole — a missing secret
> should **deny**, not allow.

### 5.5 🟠 Vercel build queue serialization + hung builds
- **Symptom:** A build stuck "Building" for 18 min blocked every later deploy.
- **Cause:** Lower Vercel plans run **one build at a time**; a hung build blocks the queue.
- **Solution:** Cancel the stuck build (dashboard or `vercel rm <url>`); avoid piling on
  `--force` deploys that deepen the queue.
> **Rule:** Don't fire multiple deploys hoping one sticks; clear the queue first.

### 5.6 🟢 Repo hygiene — never commit generated/boilerplate
- **What happened:** The generated Prisma client (incl. a 17–21MB engine binary + temp files),
  CNA boilerplate SVGs, and internal planning `.md`s were tracked.
- **Solution:** `.gitignore` the generated client and rebuild it at deploy time via a build
  script: `"build": "prisma generate && next build"`. Gitignore boilerplate + internal docs.
- **Why:** Generated artifacts bloat the repo, cause merge noise, and go stale. Rebuilding at
  build time guarantees the binary matches the deploy platform (Linux on Vercel).
> **Rule:** Generated code is a build artifact, not source. Gitignore it; generate in the build.

### 5.7 Custom domain + DNS (subdomain on Vercel)
- **Setup:** `quotegen.kreateup.in` (subdomain of a Hostinger-registered domain) → added as a
  Vercel domain → **A record `quotegen` → `76.76.21.21`** in the registrar's DNS. Vercel
  auto-issues SSL. Apex/root site is untouched (only the subdomain record is added).
> **Rule:** Subdomain on Vercel = one A record (or CNAME to `cname.vercel-dns.com`). It doesn't
> affect the root domain. SSL is automatic; don't buy certs.

---

## 6. Security playbook

A full audit ("Sprint 9") plus the live-deploy hardening produced this checklist. Multi-tenant
isolation was verified with **real-DB tests** proving cross-tenant `findUnique/update/delete`
are blocked.

| Area | What we did | Why |
|---|---|---|
| **Tenant isolation** | Deny-by-default Prisma extension (§3.1) + real-DB isolation tests | One missed `where` = data leak |
| **Auth** | JWT 24h expiry, bcrypt cost-12, account lockout (5 fails → 15 min) | Limit blast radius of stolen tokens / brute force |
| **Session revocation** | `User.tokenVersion` embedded in JWT, re-checked per request (cached 60s); bumped on password reset, role change, deactivate | JWTs are otherwise valid until expiry — this gives instant revocation |
| **Rate limiting** | Per-IP (15-min) + per-IP burst (1-min) + **per-account** (1-min) on login; payment + signup + reset limited. Distributed via Upstash Redis | Per-account catches credential-stuffing from rotating IPs that per-IP misses |
| **CSRF** | `originAllowed()` rejects state-changing requests with a mismatched Origin (prod only); same-origin host fallback | Blocks cross-site form posts using a victim's cookies |
| **Injection** | Prisma parameterizes everything; **zero raw SQL**; Zod validation on input routes | SQL injection structurally impossible via the ORM |
| **XSS** | HTML-escape user fields in server-rendered HTML (e.g. printable invoices) | User data in HTML is an injection vector |
| **Error leakage** | Catch blocks return generic `"Internal server error"`; full detail logged server-side only | Stack traces / Prisma internals must not reach the client |
| **Account enumeration** | Login reveals account-state ("deactivated") only **after** a correct password | Pre-password messages let attackers enumerate valid emails |
| **Headers** | CSP, HSTS (preload), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy via `next.config` | Defense-in-depth at the transport/DOM layer |
| **Cron** | Header-only bearer auth, **fail-closed** (§5.4) | Public crons = unauthenticated data deletion |
| **Secrets** | Never commit `.env`; scrub secrets from docs; rotate anything exposed | A secret in git history is compromised forever |
| **DDoS** | App-level rate limiting (Redis) + **recommend Vercel WAF / Attack Challenge Mode** | Volumetric attacks need platform-level mitigation, not app code |

> **Rule:** App code handles *application* abuse (rate limits, auth). *Volumetric* DDoS is a
> platform/WAF concern — don't pretend code-level limits are DDoS protection.

---

## 7. Performance playbook

1. **Co-locate functions with the DB region** (§5.3) — the biggest win by far.
2. **Use the pooled DB connection** with `pgbouncer=true` (§5.2) — and keep `connection_limit`
   modest on serverless.
3. **Minimize per-request DB round-trips.** `withApi` does several checks; they're cached
   in-memory 60s per lambda. Cross-region latency multiplies every uncached query — another
   reason §5.3 matters. Independent checks can be parallelized (`Promise.all`).
4. **"Lazy loading" feel is often client-fetch waterfalls** — pages fetch data on mount, one
   after another. The backend being fast (post §5.3) fixes most of it; converting the heaviest
   pages to server-rendered removes the loaders entirely.
5. **Cold starts** are inherent to serverless; co-location + keeping functions small helps.
> **Rule:** Latency budget = network (region) + round-trips (query count) + work. Attack them
> in that order; region first.

---

## 8. Debugging methodology

The deployment bugs were solved with a repeatable loop:

1. **Read the actual error**, not the symptom. The login 500 looked like an auth bug; the logs
   said `PrismaClientInitializationError`. Always pull server logs (`vercel logs --expand`).
2. **Add a temporary `console.error(err)`** in the catch block when the client only shows a
   generic message — then read the real stack server-side, then remove it.
3. **Find a control group.** Login worked while `withApi` routes failed → the bug is in the
   shared wrapper or DB layer, not the handler. Compare a working path to a broken one.
4. **Reproduce against the real environment** with `curl` (status code + `%{time_total}`).
   Timing alone diagnosed the region-latency issue.
5. **Change one variable at a time** and re-measure. Region fix → re-measure → 10× better.
6. **Prefer fixing in code over fixing in config** when the config is easy to get wrong
   (pooling flag, §5.2).
> **Rule:** Logs → reproduce → isolate via a control group → one change at a time → verify live.

---

## 9. Reusable rules cheat-sheet

Copy this block into a new project's instructions.

**Architecture**
- Multi-tenant: enforce `companyId` isolation at the data layer (deny-by-default), not per query. Make cross-tenant access explicit + greppable.
- One edge middleware as the auth/routing choke point; route handlers trust forwarded identity headers.
- Wrap API routes in one composable middleware; keep auth routes thin as a debugging control group.

**Database**
- Neon pooled URL **must** have `pgbouncer=true`; enforce it in code. "Works then hangs under load" = pooler/prepared-statement mismatch.
- Co-locate serverless functions with the DB region (`vercel.json` `regions`).
- Migrate-diff-only on live/drifted DBs: `migrate diff` → review SQL → `db execute`. Never `migrate dev`. Restart long-running dev servers after a column migration.

**Next.js + Vercel + Prisma**
- Use the classic `prisma-client-js` generator (node_modules) + `serverExternalPackages: ['@prisma/client']`. Avoid custom-output ESM clients with Turbopack.
- "Could not locate the Query Engine" = a bundling/externalization problem, not a missing binary.
- Generated code is a build artifact: gitignore it, run `prisma generate && next build`.
- One build at a time on lower plans — clear hung builds instead of stacking `--force` deploys.

**Security**
- Security gates fail CLOSED; infra niceties (rate-limit/Redis/Sentry) fail OPEN.
- Server-authoritative for money, permissions, identity. Verify payment signatures timing-safe.
- Rate-limit per-IP **and** per-account. Use a shared store (Redis) so limits hold across the fleet.
- Generic client errors, detailed server logs. Reveal account state only post-password.
- Never commit secrets; rotate exposed ones. App code ≠ DDoS protection (use WAF).

**Process**
- Living checklist + decisions memory (state the *why*).
- Verify three ways: `tsc` → `build` → live round-trip.
- Debug loop: logs → reproduce → isolate (control group) → one change → verify.

---

## 10. File storage, multi-account pools, feature flags & secrets

Learnings from building a document vault on a free third-party storage tier (UploadThing).

### 10.1 Third-party upload + a strict CSP = two separate allowances
- **Symptom:** uploads failed with a generic "something went wrong"; the server *received* the
  presign call fine.
- **Cause:** the browser uploads the file **directly to the storage vendor's domain**. Our CSP
  `connect-src` only listed self/payment/Sentry, so that cross-origin upload XHR was blocked. PDF
  *preview* later failed too — `frame-src` blocked the vendor iframe.
- **Rule:** when a client SDK talks to a vendor domain, allow it in **every** relevant CSP
  directive — `connect-src` (upload/fetch), `img-src` (display), `frame-src` (iframe preview).
  The server receiving the presign call tells you nothing about the *next* hop the browser makes.

### 10.2 Shared free tier → enforce quotas, don't assume per-tenant capacity
- One vendor account = one shared pool across **all** tenants. A "2GB" free tier is 2GB *total*,
  not per company. Don't show or imply per-company capacity you don't have.
- **Rule:** track usage centrally (sum a `sizeBytes` column), enforce a platform-total ceiling on
  every upload, and make any per-tenant cap an **explicit, optional override** — not a default.
- **Compress before upload:** re-encode images to WebP at a capped resolution client-side (a 4MB
  photo → ~100KB). Keep *documents* in their original format (a contract PDF must stay a PDF).

### 10.3 Designing for "add more storage later" (multi-account pools)
- Model storage as **pools**, each an account. Record the pool on every file (`storagePool`) so a
  tenant's files can span pools and **deletion always uses the right account's token**. Total
  capacity = **sum of pool capacities**, so adding an account grows capacity with no code change.
- **Admin-managed pools beat env-only:** store added tokens in a table, **encrypted at rest**
  (AES-256-GCM, key derived from an existing app secret). Keep the env token as an always-present
  fallback. Block deleting a pool that still holds files (would orphan them).
- **The hard edge case — callback/token agreement:** the upload and its asynchronous *signed
  callback* must use the **same** account token, or signature verification fails and the
  completion handler never runs. Resolve the target pool from **stored state** (not a random
  pick) so both requests agree. Switching the active pool mid-upload is a rare race — document it.
- **Rule:** make the scaling path real in the data model from day one (per-file pool id, summed
  capacity, encrypted tokens) even if you launch with one account.

### 10.4 Feature-gating vs permission-gating are different axes — don't conflate them
- A new module often needs to be **feature-gated by plan** (does this company's plan include it?)
  but **not permission-gated per user** (every user in the company can use it).
- Our edge proxy does *permission* checks by path→module; `withApi` does *feature* checks by the
  same map. Mapping a path to a module turned on **both** — which would 403 users who lack that
  permission. Fix: add the path to the proxy's **always-allowed** list (skips the permission
  check) while keeping the module map (so the feature gate still runs in `withApi`).
- **Rule:** separate "who can reach it" (permission) from "is it in the plan" (feature). New
  plan-features default **ON** so existing tenants never lose access (opt-out, not opt-in).

### 10.5 Promoting new features in-product
- A one-time "what's new" modal keyed by a **versioned** localStorage flag (`spotlight_x_v1`) is a
  zero-backend way to surface a new feature to existing tenants. Versioning the key lets you run a
  fresh spotlight later without re-showing old ones.

### 10.6 Surface opaque IDs where operators need them
- A cuid primary key is invisible until support needs it. Show the company id (with a copy button)
  in the admin console — operators reference records by id constantly.

---

*Generated from the QuoteGen build (Phase 0 → live production, 2026-06). Treat every "Rule"
as a default to apply unless the new project has a specific reason not to.*
