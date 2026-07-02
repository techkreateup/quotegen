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
16. [Payment integrations: trust nothing, verify everything](#16-payment-integrations-trust-nothing-verify-everything)
20. [Document "Convert" chain (Track D)](#20-document-convert-chain-track-d--one-engine-per-pair-mapping)

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

## 11. Settings & form-to-DB pitfalls

### 11.1 Never spread a form body into Prisma `upsert`/`update`
- **Symptom:** Settings save silently fails with "Unknown argument" Prisma validation error.
- **Root cause:** The PUT route did `prisma.companySettings.upsert({ update: { ...body } })`.
  The form sends fields that are NOT DB columns (`updatedAt`, `id`, `companyId`, and later
  `gstEnabled` before it was a real column). Any unknown key → Prisma rejects the entire write.
- **Solution:** Explicit column whitelists (`STRING_FIELDS`, `INT_FIELDS`, `ARRAY_FIELDS`,
  `BOOL_FIELDS`) — iterate and pick only known fields from the body. Add new columns to the
  correct whitelist.
- **Why not `.omit()`:** The set of "bad" fields grows unpredictably (UI adds state, metadata,
  computed fields). A whitelist is closed by default; an omit-list is open and will break again.
> **Rule:** API routes that persist user input must whitelist allowed columns, never spread the
> raw body. This applies to any ORM that validates unknown fields.

### 11.2 Client-side toggles that look like they persist but don't
- **Symptom:** `gstEnabled` toggle resets on reload.
- **Cause:** It was only React state, never a DB column. The settings form saved it to the API,
  but the API ignored it (or errored, see §11.1).
- **Solution:** Add the column (`Boolean @default(true)`), add it to the whitelist, done.
> **Rule:** If a UI control implies persistence (toggle, checkbox that survives page reload),
> verify the backing column actually exists. "It's always been client-side" is a bug, not a feature.

---

## 12. Validation schema ↔ UI field alignment

### 12.1 Schema must match the UI's primary field, not the DB column name you'd guess
- **Symptom:** Creating quotations/invoices/credit notes returned 400 "Validation failed" with
  `fieldErrors: { "items.0.description": "Item description is required" }`.
- **Root cause:** `lineItemSchema` required `description` (min 1 char). But the line-item editor
  UI uses `itemName` as the primary text field (big input, labelled "Item Name") and treats
  `description` as optional (small textarea, labelled "Description (optional)"). The DB column
  is `itemName`.
- **Fix:** Require `itemName`, make `description` optional (`optionalString(1000)`). Since
  invoices and credit notes share the same schema, one fix unblocked all three.
- **Debugging tip:** When a user reports "can't create X" and blames a nearby feature (they
  blamed the Decision Advisor card next to the form), **read `fieldErrors` from the 400 body**
  — the `parse()` helper includes them. Don't trust the user's attribution.
> **Rule:** Zod schemas must validate what the UI actually sends, not what the data model
> idealistically wants. If the form's primary input maps to `fieldA`, require `fieldA` — even
> if `fieldB` sounds more "correct".

---

## 13. Signatures, approvals & authority separation

### 13.1 Signing authority ≠ approval authority
- A template may carry fixed designated signers (e.g. CEO sign + HR sign always present on an
  offer letter). Approval is a *separate* workflow — if an HR intern creates the document, HR
  (the role) approves it. Both coexist: signs are stamped content; approval is a status gate.
- **Implementation:** `Signature` model (org-wide library, role-tagged) → `DocumentSignature`
  (many per document, source: `template`/`approval`/`manual`). `WorkflowApproval` optionally
  captures a signature when the approver approves a document.
> **Rule:** Don't conflate "who signs" with "who approves". Model them as separate concerns
> that can *optionally* intersect (approver may sign, but signing doesn't imply approval power).

### 13.2 Live preview of content that's only applied at export time
- **Symptom:** Signatures added to a template were invisible in the editor — they only appeared
  in the exported PDF.
- **Cause:** `withSigns()` appended the signature block during `renderDocument()` at export,
  but the editor's `contentEditable` div had no knowledge of it.
- **Solution:** `syncSignBlock` (useCallback + useEffect) injects a `[data-sig-block]` div into
  the live contentEditable, kept in sync with signatories/values/brand changes. `cleanBody()`
  strips it from the saved HTML (signatories stored separately in JSON, not duplicated in HTML).
> **Rule:** If the user edits content that has "decoration" added at export/render time (headers,
> footers, watermarks, signatures), inject a live preview of that decoration into the editor.
> Strip it before saving to avoid duplication.

### 13.3 Template pre-fill with realistic sample data
- **Symptom:** Built-in templates opened with empty values showing gray `[placeholders]` — users
  couldn't tell what the document would look like.
- **Solution:** `sampleValues()` in `doc-templates.ts` provides per-field-key realistic data
  (names, amounts, dates) with a "Sample / Clear" toggle. Pre-fills on mount.
> **Rule:** Templates should preview with realistic data, not empty fields. Provide a
> sample-data mode so users see the layout immediately.

---

## 14. Reusable rules cheat-sheet (continued)

**Forms & Validation**
- API routes that persist user input: whitelist allowed columns, never spread the raw body.
- Zod schemas must validate what the UI actually sends. If the form's primary input is `itemName`, require that — not `description`.
- If a UI control implies persistence (toggle, checkbox), verify the backing DB column exists.
- When a 400 "validation failed" is reported, read `fieldErrors` from the response body before blaming nearby features.

**Document & Template Patterns**
- Signing authority ≠ approval authority. Model them separately.
- If the user edits content that has decoration added at export time, inject a live preview into the editor; strip before saving.
- Templates should preview with realistic sample data, not empty fields.
- New tenant models → add to `TENANT_MODELS` in `src/lib/db.ts` immediately.

**Serverless Caching**
- In-memory caches (Map) are per-instance on serverless — a revoked session stays valid on other instances until TTL expires. Use a shared store (Redis) for security-critical caches.
- Write cache helpers that fall back to in-memory when Redis is unavailable (fail-open for caches, unlike fail-closed for auth gates). Keep both layers in sync: set in-memory AND Redis on write, delete from both on invalidate.

---

## 15. Serverless caching: in-memory is per-instance

### 15.1 Security caches must be distributed
- **Symptom (potential):** Admin disables a company or revokes a user session, but the user
  continues to access the app for up to 60 seconds on a different serverless instance.
- **Root cause:** `withApi` cached `tokenVersion`, `company.isActive`, and `emailVerified` in
  in-memory Maps. On Vercel with auto-scaling, each lambda has its own Map — invalidation on
  one instance doesn't reach the others.
- **Solution:** Moved all three caches to Upstash Redis (same instance already provisioned for
  rate limiting). Cache keys: `tv:<userId>`, `ca:<companyId>`, `uv:<userId>`. 60s TTL via Redis
  `EX`. Falls back to in-memory Map when Redis is unavailable (fail-open for caches — a cache
  miss just hits the DB, which is always authoritative).
- **Pattern:** `cacheGet`/`cacheSet`/`cacheDel` helpers that write to BOTH in-memory and Redis
  on set (so the local instance is fast), but check Redis first on get (so cross-instance
  invalidation works). On `cacheDel`, clear both. For bulk invalidation (`revokeRoleSessions`),
  clear the in-memory prefix and let Redis keys auto-expire (60s).
> **Rule:** On serverless, any cache that gates security decisions (session validity, account
> status) must be shared across instances. In-memory caches are fine for performance
> optimization but not for security enforcement.

---

## 16. Payment integrations: trust nothing, verify everything

### 16.1 The API key that "exists" doesn't mean it works
- **Symptom:** App returns 500 on `POST /api/payments/create-order`. Server logs show
  `{ statusCode: 401, error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' } }`
  from Razorpay. New keys were just provisioned on Vercel — same error.
- **Root cause:** Two separate failures stacked: (1) earlier `vercel env add` piped via `echo`
  set empty strings instead of the real values; (2) the "new" keys handed over by the user were
  already invalidated/regenerated in the Razorpay dashboard before they reached us, so even
  after fixing the env-var population they failed authentication at the provider.
- **Solution:** Always verify a third-party credential **against the provider's own API**
  before believing it. One curl call settles it:
  `curl -u "KEY:SECRET" -X POST https://api.razorpay.com/v1/orders -d '{"amount":100,"currency":"INR","receipt":"x"}'`.
  A `200`/`201` proves the key works; a `401` proves it doesn't and saves a deploy cycle.
- **Why this method:** Production logs only tell you what your app saw — `401 from Razorpay`
  could be a wiring bug, a value-injection bug, or a bad credential. Pinging the provider
  directly factors out every variable except the credential itself.
- **Also:** When piping secrets to `vercel env add` via stdin, prefer `printf` over `echo` and
  avoid heredocs; always `vercel env pull` afterward to confirm the value made it through (CLI
  silently accepts empty input).
> **Rule:** Before debugging your code, prove the third-party credential works against the
> third party's own API. Curl > guessing.

### 16.2 GST-inclusive money: back it out once, reuse the math
- **Symptom (anticipated):** "Is ₹499 inclusive of GST or +18%?" — every paying customer asks.
  Without a single source of truth for the split, the checkout page, the email receipt, and the
  GST invoice can disagree.
- **Root cause / setup:** Razorpay always captures a single gross amount in paise. Indian SaaS
  needs that gross to be presented as **taxable + GST** on the invoice (SAC 9983 → 18%). If
  every surface computes its own split, rounding drifts and the columns don't tie.
- **Solution:** Single helper `splitGstInclusive(grossRupees, rate)` returns
  `{ taxable, tax, gross }` with consistent paise-rounding. The checkout page, the printable
  invoice HTML, and `subscription-invoice.ts` all call it. Provider's GST rate, state, and
  GSTIN live in `PlatformSetting` (DB-backed, super-admin-editable) — not in code or env vars —
  so the platform can change rates without a deploy.
- **Why this method:** The rate is regulatory and changes over time (different slabs, different
  jurisdictions). Putting it in DB-backed settings lets ops change it; centralizing the math
  means the displayed breakdown always matches the issued invoice.
- **Intra-state vs inter-state:** Customer's `companySettings.state` matches provider's state →
  CGST+SGST (split 50/50); otherwise → IGST (full tax in one line). The check is a
  lowercase string compare — easy to get wrong if you forget to normalize.
> **Rule:** Treat the captured Razorpay amount as GST-inclusive and back out the components
> once. Store the rate where ops can change it, not in code.

### 16.4 Invoice PDFs: A4 + @media print + browser dialog beats a PDF lib
- **Symptom:** First version of the GST invoice was a 30-line HTML doc — looked unprofessional
  next to Anthropic/Stripe receipts. User wanted a "real" invoice and offered competitor PDFs
  as references.
- **Root cause:** No `@page` rule, no print styles, no two-column issuer/bill-to layout, no
  visible totals hierarchy, no brand block. Just `<table><tr><td>` with default browser styling.
- **Solution:** A single template module (`billing-pdf-template.ts`) that renders proper A4
  HTML with: `@page { size: A4; margin: 18mm 14mm }`, `@media print { ... }` to hide chrome,
  big `<h1>` heading, metadata table, two-column grid for issuer/bill-to with addresses + GSTINs,
  proper item table with description/qty/unit-price/amount columns, right-aligned totals stack
  with subtotal + taxes + grand total, optional payment-history section for the "receipt" variant,
  footer with "Powered by …". A "Print / Save as PDF" button at the top kicks off the browser's
  native print dialog (hidden on print).
- **Why this method:** Rendering HTML via the browser print pipeline produces a clean A4 PDF
  with selectable text, real fonts, and no server-side dependencies (no Puppeteer, no Chromium,
  no `pdf-lib`, no node-canvas). For a one-page subscription receipt this is the right size of
  hammer. Heavyweight PDF libs only earn their cost when you need pixel-precise multi-page
  layouts, watermarks, or attachments.
- **Brand fields belong in PlatformSetting, not env vars:** name, legal name, address, email,
  phone, website, logo URL, "Powered by …" — all DB-backed so non-engineers can update them
  without a deploy. Same pattern as GST rate.
> **Rule:** For one-page transactional PDFs (invoice/receipt/quote), generate clean print-styled
> HTML and let the browser produce the PDF. Reserve PDF libraries for layouts they're uniquely
> good at.

### 16.5 GST inclusive vs exclusive: where the mode actually matters
- **Symptom (anticipated):** Builder configures plan prices in two ways — "₹499 all-in" or
  "₹499 + GST". Code that hard-codes one interpretation will mis-charge the customer or print
  a wrong invoice.
- **Root cause / setup:** "GST mode" is really a question about ONE place: the moment the
  plan price becomes a Razorpay charge amount. *After* capture, the captured paise IS the
  gross — so the invoice always backs out base + tax the same way. Only `create-order` needs
  to know: inclusive → charge = price; exclusive → charge = price × (1 + rate).
- **Solution:** Single `platform_gst_mode` setting ("inclusive" | "exclusive"). Read it in
  `create-order` to compute `expectedAmount`. `/api/plans/public` exposes mode + rate so the
  checkout page can show the correct breakdown ("incl. GST" vs "GST added on top"). The
  invoice generator stays unchanged — by the time it runs, the gross is settled.
- **Why this method:** Keeps the mode-aware code path tiny (one line in create-order, one
  conditional in checkout display). The rest of the system stays oblivious. Adding new modes
  later (zero-rated exports, reverse charge) means changing those two places, not the whole
  pipeline.
> **Rule:** Identify the *single point* where a configuration setting actually changes
> behavior, and constrain awareness of it there. Don't sprinkle `if (mode === 'X')` across
> the codebase.

### 16.3 Test mode UPI uses fixed IDs; real IDs reject
- **Symptom:** In Razorpay TEST mode, entering a real GPay/PhonePe UPI ID → "invalid UPI id".
  Users assume the integration is broken.
- **Root cause:** Test mode only accepts the synthetic IDs `success@razorpay` (simulates
  capture) and `failure@razorpay` (simulates failure). Real PSP-routed UPI IDs only work in
  LIVE mode. Same applies to test cards — the documented `4111 1111 1111 1111` is sometimes
  flagged "International cards not supported" on accounts without international payments
  enabled; the domestic Indian test cards (`5267 3181 8797 5449` Mastercard, `4012 8888 8888
  1881` Visa, `6073 8499 5454 8403` RuPay) work reliably.
> **Rule:** Document the *exact* test instruments per provider in onboarding docs. "Use test
> card 4111…" without the domestic caveat will burn an hour of support time.

---

## 17. Stacked redirect gates can form an infinite loop

### 17.1 Two independent "must-do-first" gates that don't exempt each other = redirect loop
- **Symptom:** A newly-invited employee could authenticate (login API returned `200` with
  `requiresPasswordReset: true`) but the browser then showed a broken/"404"-looking page. A
  cookie-jar curl trace revealed the truth: `/` → 307 `/reset-password` → 307 `/accept-terms`
  → 307 `/reset-password` → … (`ERR_TOO_MANY_REDIRECTS`).
- **Root cause:** `proxy.ts` has two sequential gates. Gate A (force password reset) redirects
  everything except `/reset-password` to `/reset-password`. Gate B (ToS acceptance) redirects
  everything except `/accept-terms` to `/accept-terms`. A user in BOTH pending states
  (`mustResetPassword: true` **and** `tosAcceptedAt: null`) bounces between the two forever —
  each gate's destination is the *other* gate's redirect trigger. This is the **default state
  of every admin-invited employee** (temp password ⇒ must-reset; never accepted ToS), so it
  silently broke first-login for all of them, not one account.
- **Solution:** Make the gates strictly ordered. Added `!payload.mustResetPassword` to Gate B's
  condition so password-reset wins: while a reset is pending, the ToS gate stands down. Once the
  password is reset (`mustResetPassword → false`), the ToS gate engages on the next navigation.
- **Why this method:** One condition encodes the priority ("reset before ToS") and removes the
  cycle, rather than special-casing each path in both gates (which re-introduces the bug the
  moment a third gate is added). Diagnosed with a **cookie-jar curl trace** (`-c`/`-b`) reading
  `%{redirect_url}` at each hop — the single fastest way to see a redirect cycle a browser hides.
> **Rule:** When multiple middleware gates each force-redirect to their own page, they must be
> **totally ordered** — gate N must exempt itself *and* every higher-priority gate's path, or
> two pending gates will ping-pong. Trace redirects with a cookie jar + `%{redirect_url}`, not a
> browser.

---

### 17.2 An empty env var fails *silently* via the `||` fallback — and "sensitive" vars hide it
- **Symptom:** All transactional email (password reset, billing, the new messaging) silently failed
  in production — Resend returned *"You can only send testing emails to your own address"* — even
  though the `kreateup.in` domain was **verified** and the API key was valid.
- **Root cause:** `EMAIL_FROM` in Vercel **Production was an empty string**. The code
  `process.env.EMAIL_FROM || "QuoteGen <onboarding@resend.dev>"` treats `""` as falsy and falls
  back to the **resend.dev sandbox sender**, which only delivers to the account owner. Empty value
  set 10 days earlier via the `vercel env add`/`echo`-stdin trap (cf. §16.1) — never noticed because
  the fallback "works" for the one address that matters during testing.
- **Two diagnostic traps:** (1) `vercel env pull` shows a **sensitive** var's value as `""` — so
  pull *cannot* confirm a real value; the only proof is **runtime behaviour** (the live app fell
  back → the var was empty at runtime). (2) `vercel env add` (CLI v54) **ignores piped stdin when an
  agent is detected** (non-interactive default) and silently stores empty — must use the explicit
  `--value '<v>'` flag. Verified the *credential* worked by POSTing Resend's `/emails` directly with
  a `@kreateup.in` From (§16.1 "prove it against the provider's API") — that succeeded, isolating the
  fault to `EMAIL_FROM`. Fixed: `vercel env add EMAIL_FROM production --value 'QuoteGen
  <noreply-quotegen@kreateup.in>' --force`, then **redeploy** (env changes need a new deployment),
  then a real prod send → `status: sent`.
> **Rule:** A `process.env.X || default` makes an *empty* env var indistinguishable from an unset
> one — and a wrong default can be silently destructive (sandbox sender, test key). Verify
> config-driven behaviour by exercising the runtime, not by reading the value back (sensitive vars
> mask on pull). For non-interactive `vercel env add`, use `--value`, never piped stdin.

---

## 18. Email & "data loss" debugging

### 18.1 Email clients block `data:` URI images — host the logo
- **Symptom:** A company logo stored as a `data:image/...;base64,…` URI (set via an inline
  uploader) renders fine in the in-app PDF/preview but shows as a **broken image** in Gmail/
  Outlook, and lands as an *attachment* rather than inline.
- **Root cause:** Major email clients strip `data:` URIs in `<img src>` (anti-tracking/anti-abuse).
  An inline **CID attachment** (`content_id`) is also unreliable across clients.
- **Solution:** Serve the logo from a **public hosted route** (`/api/public/company-logo?c=<id>`
  that decodes the data-URI and returns the bytes), and rewrite data-URI logos to that URL before
  composing the email. Hosted https images render inline everywhere.
> **Rule:** Email logos/images must be real hosted https URLs. `data:` URIs and (often) CID
> attachments don't render. The browser/PDF rendering working tells you nothing about email.

### 18.2 Show users formatted text, never raw HTML
- **Symptom:** Users saw `<p>Hi …</p><p>…</p>` in the "Message" box of the send dialog and were
  confused.
- **Solution:** Default the field to a **rendered preview**; offer an "Edit text" toggle to a
  PLAIN-TEXT editor; convert plain text → safe HTML (`textToHtml`: paragraphs + clickable links)
  on send. Users never see tags.
> **Rule:** Don't expose raw HTML in user-facing editors. Edit plain text or rich text; render HTML.

### 18.3 Before declaring "data loss", read the audit log
- **Symptom:** A whole table appeared wiped (Invoice count 0 across all companies; PaymentReceipt/
  CreditNote also empty). Looked like catastrophic corruption or a destructive migration.
- **Root cause:** Nothing was corrupted — a user had **deleted the records through the app's normal
  DELETE endpoint** (audit-logged, one at a time), and PaymentReceipt/CreditNote vanished via the
  **designed `onDelete: Cascade`** from Invoice. The empty tables were correct behaviour.
- **Solution:** Query `AuditLog` for `action: 'DELETE'` events — entity, entityId, userId, timestamp
  immediately showed *who* deleted *what* and *when*. App deletes are audit-logged; raw DB deletes
  are not, so an audit trail = legitimate app action.
- **Why this method:** It distinguishes "intentional user action" from "bug/corruption" in one query,
  before alarming anyone or attempting a risky restore. Also: cascade deletes mean an empty child
  table often just means the parent was deleted — check the parent and the FK `onDelete` before
  assuming independent loss.
> **Rule:** "Missing data" → check `AuditLog` for DELETE events and check FK cascades FIRST. Don't
> escalate to "data-loss incident" until you've ruled out audit-logged user deletes + cascade.

---

## 19. Document-number counters drift → make them self-healing

- **Symptom:** Saving a quotation (or any numbered doc) 500'd. Server log: Prisma **P2002**
  `Unique constraint failed on the fields: (companyId, quotationNo)`.
- **Root cause:** Doc numbers come from a per-company counter (`CompanySettings.nextQuotationNo`)
  claimed by `nextDocNumber()`. The counter had **drifted behind** the actual data — documents
  existed with numbers ≥ the counter (from imports/seeds/restores that didn't bump it), so the
  next claim produced a number that already existed and the unique index rejected the insert.
- **Solution:** Made `nextDocNumber()` **self-healing**: a counter→`[model, field]` map lets it,
  inside the same transaction, find the highest number already issued for that doc type and bump
  the counter past it *before* claiming. A drifted counter corrects itself on the next save, for
  every company — no manual DB reconcile, no per-caller changes. Reconcile is best-effort
  (try/catch) so it can never make saves worse.
- **Why this method:** Fixing the *data* (re-syncing counters) heals today but the drift recurs on
  the next import/restore; fixing the *code* makes the system tolerant of drift permanently. The
  per-counter map keeps all call sites unchanged.
- **Diagnosis tip:** a generic client `"Internal server error"` hid a precise P2002 — reproduce on
  the **dev server** (which logs the real stack) or pull prod logs; never debug from the generic
  message. (LEARNING §8.)
> **Rule:** Sequence counters kept separately from the data **will** drift (imports, restores,
> manual edits). Make the allocator reconcile against the real max before issuing, inside the
> claiming transaction — don't trust the stored counter alone.

## 20. Document "Convert" chain (Track D) — one engine, per-pair mapping

- **Context:** Track D added the sell-side documents **Sales Order** and **Delivery Challan** plus
  the convert chain **Quotation → Sales Order → Delivery Challan → Invoice** (with the shortcuts
  Quote→Invoice and SO→Invoice), and client-PO capture on the SO (number/date/file link, D2).
- **Decision — centralise conversion:** `src/lib/convert.ts` `convertDocument({fromType, fromId,
  toType})` owns *all* sell-side conversions in one transaction: loads the source (+items+client),
  carries the shared financial/content fields (`CARRY_FIELDS`), re-runs `sanitizeLineItems` so
  foreign keys don't leak into the target's `create`, claims the target's number series via
  `nextDocNumber` (self-healing, §19), links the source id, and advances the source status
  (quote→Won, SO→Delivered/Invoiced, challan→Invoiced). An `ALLOWED` map is the allow-list of legal
  pairs; status advance is best-effort (try/catch) so a moved source never fails the conversion.
- **Invoice numbering reused, not reimplemented:** the invoice branch re-applies the exact GST vs
  non-GST series rule from `POST /api/invoices` (separateGstInvoices + client GSTIN → `nextInvoiceNo`
  vs `nextNonGstInvoiceNo`). Keep that logic in lock-step if either side changes.
- **Convert endpoints live under the TARGET module's path** (`/api/sales-orders/convert`,
  `/api/delivery-challans/convert`, `/api/invoices/convert`) so `resolveModuleFromPath` in the proxy
  auto-gates them by the target's `create` permission — no allow-list edit, no manual permission
  check in the handler. New API paths that need gating must be added to `PATH_TO_MODULE` /
  `API_PATH_TO_MODULE` in `permissions.ts` **and** to `MODULES`/labels/categories.
- **New modules checklist (what "wire a sell-side doc" touches):** schema model + `*LineItem` +
  enum + reverse relations + CompanySettings counter/prefix → migrate-diff→db-execute → `generate`;
  `TENANT_MODELS` (parent only, not line-item children); `numbering.ts` (`DocCounter` union +
  `PREFIX_FIELD` + `RECONCILE_SOURCE`); Zod create+update schemas; `permissions.ts` (5 spots);
  `cycle-config.ts` stage `module` key; `Sidebar.tsx` nav; `DocumentPreview` `type` union; `types.ts`.
- **Proforma = quote variant, not a new model:** added `Quotation.docType` ("Quotation"|"Proforma")
  + its own series (`proformaPrefix` PI / `nextProformaNo`, reconcile-source = the quotation table,
  same two-series-one-table trick as GST/non-GST invoices). One field reuses the entire quote
  editor/list/view AND the convert chain — a Proforma converts to SO/Invoice with zero extra code.
  The POST picks the counter by `docType`; UI toggles label/series. Avoided a parallel model + CRUD.
- **Pipeline (D3) is a derived view, no "deal" entity:** `/pipeline` buckets existing documents into
  lifecycle columns (Lead=clients with no docs → Quoted → SO → Delivered → Invoiced → Paid) purely
  from the list APIs, client-side. Cheap, always in sync, gated by the `dashboard` module like
  Reports/Approvals (add the route to `PATH_TO_MODULE` → dashboard; no new permission module).
- **Verified live** (test company → Neon): Q00003 → SO00001 → DC00001 + INV00004 (SO auto-moved to
  `Invoiced`); Proforma PI00001 issued independently of Q-series; pipeline board bucketed correctly
  (SO excluded once Invoiced). items + source links + per-type number series all correct; tsc+build green.
- **Closing the loop = making links VISIBLE (2026-07-01 review fix):** first cut stored the source
  ids but showed nothing, so the flow felt disconnected/dead-ended. Fix: `src/lib/lineage.ts`
  `buildLineage(kind,id)` returns `{source[],children[]}` (up/down-stream docs); every `[id]` GET
  returns it as `related`; a `<DocumentLineage>` component renders the chain
  Quotation→SO→Challan→Invoice with clickable chips + statuses on all four views, plus a "next step"
  hint when there are no children. Also added convert actions to the *quote view* (were missing) and
  unified quote→invoice to the direct-convert engine everywhere (was two behaviours: list used the
  `/invoices/new?from_quotation=` editor-prefill, view used direct — inconsistent).
- **A pipeline must be a decision tool, not a card dump** (web: Zoho/HubSpot/weighted-pipeline).
  `/pipeline` now has a KPI header (Open pipeline, **weighted forecast** = Σ stageValue×prob,
  Awaiting payment, **Overdue** in red) + per-stage value totals + **aging/stale flags** (quote >14d,
  SO >21d, challan >7d amber; invoices past due red) sorted flagged-first. Derived from list APIs,
  no deal entity.
> **Rule:** For a family of near-identical documents, build ONE convert engine with a per-pair
> mapping table, not N bespoke "create-from-X" routes; route each convert under its target module's
> API path so existing permission/feature gating applies for free. **And linking documents in the DB
> is only half the job — surface the chain in the UI (both directions) or users won't feel the loop.**

## 21. Cadence entity plurality — engine agnostic, contexts do the work

- **Symptom:** vendor bills need the same "reminder N days before due, then again on due day"
  behaviour we already ship for invoices, but the cadence engine was hard-wired to
  `entityType === "invoice"` for its stop-on-paid check.
- **Root cause:** the cadence runner peeked into `context.invoice.balance` directly, so any new
  entity had to fake being an invoice — a leaky abstraction.
- **Solution:** two edits: (1) `buildEntityContext` gained a `purchaseBill` case that shapes the
  same fields under `context.bill.{number,total,balance,dueDate}`; (2) the runner now reads
  `ctx.invoice?.balance ?? ctx.bill?.balance` when `entityType ∈ {invoice, purchaseBill}`.
  Adding the new cadence trigger became one entry in `DEFAULT_CADENCES` + one system template.
  Auto-enrol wires in from the doc's POST handler (`enrollEntity("vendor_bill_due", …)`).
- **Why this method:** the engine stays entity-agnostic — every future doc type (recurring
  invoices, subscriptions, project milestones) plugs in via *context shape* + one row in
  DEFAULT_CADENCES, not code in `runCadencesForCompany`. This mirrors the "one convert engine,
  per-pair mapping" rule from §20: engines are for orchestration, context maps are for shape.
- **Rule:** When you want a proven engine to handle a new entity, extend the **shape it reads**
  (entity context + a lookup table) — never branch inside the engine on `entityType`.

---

*This file is living documentation. When a new bug is fixed, a non-obvious pattern is
discovered, or an architecture decision is made, append a new section following the format:
Symptom → Root cause → Solution → Why this method → Reusable rule.*
