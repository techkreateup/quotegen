# QuoteGen — Master Sprint Plan

> **Created:** 2026-06-18 · **Status:** Active
> **Purpose:** Step-by-step roadmap from current state → production-ready paid SaaS.
> Start each new Claude Code session by saying: "Continue from SPRINT.md — pick up the next unchecked item."

---

## How to use this doc

- Items are ordered by priority within each sprint.
- Check off `[x]` as each item is completed.
- Items marked ⚡ are quick wins (<30 min) that can run in parallel with bigger items.
- Items marked 🔒 have credentials/secrets — never commit them to git.
- Follow the **migrate-diff-only rule**: generate SQL via `prisma migrate diff`, never run `migrate dev`.

---

## Sprint 1 — Payments & Critical Infrastructure
> **Goal:** Accept money + fix data integrity issues that block production.

### 1.1 🔒 Razorpay Integration (P0 — #1 blocker)
- [x] Install `razorpay` npm package
- [x] Add env vars to `.env` (NEVER commit). The real test values live ONLY in `.env`
  (and the deploy host's secret store) — never in this doc:
  ```
  RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
  RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
  NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
  ```
- [x] Create `src/lib/razorpay.ts` — server-side Razorpay instance (key + secret from env)
- [x] Create `POST /api/payments/create-order` — calls Razorpay Orders API
  - Validate amount ≥ 100 paise, currency = INR
  - Return `{ orderId, amount, currency }`
  - Rate limit: 10/min per company
- [x] Create `POST /api/payments/verify` — HMAC-SHA256 signature verification
  - `HMAC(order_id + "|" + payment_id, KEY_SECRET)` vs `razorpay_signature`
  - On success: update subscription status, log audit event
  - On mismatch: return 400, do NOT mark as paid
- [x] Create `POST /api/webhooks/razorpay` — webhook handler for async events
  - Verify webhook signature (X-Razorpay-Signature header)
  - Handle: `payment.captured`, `payment.failed`, `subscription.charged`, `subscription.halted`
  - Idempotent (check if already processed by razorpay_payment_id)
- [x] Add Razorpay checkout script to `/plans` page or a new `/checkout` page
  - New `/checkout` page + reusable `src/lib/razorpay-checkout.ts` loader.
  - `/plans` buttons stay disabled (launch promo) — wired in Sprint 5.1.
- [x] Add `Payment` model to Prisma schema (named `BillingPayment` to avoid clashing
  with the in-app vendor-subscription `SubscriptionPayment` model)
- [x] Generate migration SQL via `prisma migrate diff` → apply with `db execute`
  - SQL: `prisma/sql/2026-06-18-billing-payments.sql` — applied 2026-06-18.
- [ ] Test with Razorpay test cards (4111... series) — needs DB applied + manual run

### 1.2 Subscription Lifecycle (P0)
- [x] Add fields to `Company` model: `subscriptionStatus` (enum: TRIALING, ACTIVE, PAST_DUE, CANCELED, FREE), `trialEndsAt`, `currentPlanId`, `razorpaySubscriptionId`
- [x] Create enum `SubscriptionStatus` in schema
- [x] Generate + apply migration SQL
  - SQL: `prisma/sql/2026-06-18-subscription-lifecycle.sql` — applied 2026-06-18.
- [x] Create `src/lib/subscription.ts` — state machine (all transitions + 7-day grace)
- [x] Create `POST /api/billing/upgrade` — upgrade plan (NOT `/api/subscriptions/*`,
  which is feature-gated to the in-app vendor-subscriptions module)
- [x] Create `POST /api/billing/cancel` — cancel
- [x] Wire webhook events to state transitions (captured→ACTIVE, failed→PAST_DUE)
  - Also wired into `/api/payments/verify`.
- [x] Add trial-end check to cron: `GET /api/cron/subscription-check` (daily, in vercel.json)
  - TRIALING→FREE on trial expiry; PAST_DUE→CANCELED past the grace window

### 1.3 Plan Limit Enforcement (P0)
- [x] Enforce seat limit on **login-user** creation — `POST /api/settings/users` (403 if
  over `company.maxUsers`). NOTE: seat = `User`, not `Employee` (employees are payroll
  records, not login seats), so the check lives on the users route rather than
  `/api/employees` as originally drafted.
- [x] `POST /api/auth/signup` — N/A: signup always creates a *new* company (its first
  admin user), so it can't exceed an existing company's seat limit. No change needed.
- [x] Create `src/lib/plan-limits.ts` — `checkSeatLimit(companyId)`, `checkFeatureAccess(companyId, feature)`
- [~] Add enforcement to other metered resources — helper ready (`checkFeatureAccess`);
  no per-month metered resources defined yet, revisit if invoice caps are introduced.

### 1.4 ⚡ Foreign-Key Indexes (parallel with 1.1) — DONE (applied 2026-06-18; plain CREATE INDEX, not CONCURRENTLY, pre-launch)
- [x] Create `prisma/sql/2026-06-18-fk-indexes.sql`:
  ```sql
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_client ON "Invoice"("clientId");
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quotation_client ON "Quotation"("clientId");
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipt_client ON "PaymentReceipt"("clientId");
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipt_invoice ON "PaymentReceipt"("invoiceId");
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creditnote_client ON "CreditNote"("clientId");
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_client ON "Project"("clientId");
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recurring_client ON "RecurringInvoice"("clientId");
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_salary_employee ON "SalaryRecord"("employeeId");
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voucher_employee ON "PaymentVoucher"("employeeId");
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_quotation ON "Invoice"("quotationId");
  ```
- [x] Update `schema.prisma` with matching `@@index` + `map:` names
- [x] Apply via `prisma db execute --file`

### 1.5 ⚡ Cascade Deletes on Client Relations (parallel with 1.1) — DONE (applied 2026-06-18)
- [x] Update schema.prisma — add `onDelete: Cascade` to:
  - `Invoice.clientId → Client`
  - `Quotation.clientId → Client`
  - `PaymentReceipt.clientId → Client`
  - `PaymentReceipt.invoiceId → Invoice`
  - `CreditNote.clientId → Client`
  - `Project.clientId → Client` (was SET NULL — now CASCADE per spec)
  - `RecurringInvoice.clientId → Client`
- [x] SQL: `prisma/sql/2026-06-18-cascade-deletes.sql` (hand-written constraint swaps)
- [x] Apply + regenerate client

### 1.6 ⚡ Create `.env.example` (parallel, 5 min)
- [x] Create `.env.example` with all required vars (no real values):
  ```
  DATABASE_URL=postgresql://user:pass@host/db?connection_limit=10&pgbouncer=true
  DIRECT_URL=postgresql://user:pass@host/db
  JWT_SECRET=your-secret-here
  APP_URL=http://localhost:3000
  ALLOWED_ORIGIN=http://localhost:3000
  CRON_SECRET=your-cron-secret
  RESEND_API_KEY=re_xxxx
  EMAIL_FROM=noreply@yourdomain.com
  RAZORPAY_KEY_ID=rzp_test_xxxx
  RAZORPAY_KEY_SECRET=xxxx
  NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxx
  SENTRY_DSN=https://xxxx@sentry.io/xxxx
  NEXT_PUBLIC_SENTRY_DSN=https://xxxx@sentry.io/xxxx
  WHATSAPP_TOKEN=your-token
  WHATSAPP_PHONE_ID=your-phone-id
  ```
- [x] Ensure `.env` is in `.gitignore` (already covered by `.env*`)

---

## Sprint 2 — Trust, Legal & Input Validation
> **Goal:** Safe for public signups — no fake accounts, legal compliance, validated data.

### 2.1 Email Verification on Signup (P1) — DONE
- [x] Add `emailVerified` + `verificationToken` to User (batched into `2026-06-18-user-trust-fields.sql`, applied; existing users grandfathered verified)
- [x] On signup: `emailVerified: false`, token, verification email via Resend
- [x] `GET /api/auth/verify-email?token=xxx` (+ `POST /api/auth/resend-verification`)
- [x] Gate sensitive actions via `withApi({ requireVerified: true })` on clients/invoices/quotations POST
- [x] Banner on dashboard (`EmailVerificationBanner` in AppShell); `/api/auth/me` now returns `emailVerified`

### 2.2 Terms of Service + Privacy Policy (P1) — DONE
- [x] Add `tosAcceptedAt` to User (same migration)
- [x] Checkbox + timestamp capture at signup (API requires `acceptTos`)
- [x] Create `/terms` and `/privacy` static pages (placeholder legal content)
- [x] Hard-block when tosAcceptedAt null — enforce on all authenticated routes; grandfathered
  users see a one-time "Accept Terms" interstitial before they can continue.
  **Done in Sprint 8.1** (proxy.ts gate + `/accept-terms` + `POST /api/auth/accept-tos`).

### 2.3 DPDP Act Compliance — Tenant Data Export + Deletion (P1) — DONE
- [x] `GET /api/settings/export-data` — full company-scoped JSON export download
- [x] `POST /api/settings/delete-account` — soft-delete (isActive=false, deletionRequestedAt),
  admin-only, name-confirm, sends email. Added `Company.deletionRequestedAt` (migration applied)
- [x] `GET /api/cron/purge-deleted` — hard-deletes past 30-day grace (in vercel.json)
- [x] `/settings/privacy` page (Export + Delete) linked in Sidebar

### 2.4 Zod Input Validation (High Priority — data integrity) — DONE (POST routes)
- [x] Install `zod` (v4)
- [x] Create `src/lib/schemas/` — single `index.ts` of schemas + `helpers.ts` (`parse()` returns
  ready 400 with `fieldErrors`). Schemas aligned to ACTUAL model fields (e.g. Client uses
  `businessName`/`phones`, Catalog uses `rate` not `price`).
  - `client.ts` — name (required, max 200), email (valid format), phone, GSTIN (regex), address
  - `invoice.ts` — clientId (cuid), items (array, min 1), amounts (positive numbers), dates
  - `quotation.ts` — same pattern as invoice
  - `employee.ts` — name, email, phone, salary (positive), joinDate
  - `vendor.ts` — name, email, GSTIN
  - `salary.ts` — employeeId, month/year (valid range), amounts (non-negative)
  - `project.ts` — name, clientId, dates, budget (non-negative)
  - `catalog.ts` — name, price (non-negative), unit
- [x] Wired into all 11 **POST** handlers (validate-as-gate, then existing logic runs)
- [x] Structured 400 with field-level `fieldErrors`
- [~] **PUT** handlers not yet wired — POST is the primary integrity gate; updates reuse the
  same shapes and can be added with `.partial()` as a follow-up.
- [x] Routes: clients, invoices, quotations, employees, vendors, salary, projects, catalog,
  transactions, credit-notes, recurring-invoices (POST each)

### 2.5 GST-Compliant Invoices for Subscription Charges (P1) — DONE
- [x] `SubscriptionInvoice` model (migration applied); `src/lib/subscription-invoice.ts`
  generator (idempotent), SAC 9983, intra-state CGST+SGST vs IGST via `PROVIDER_GST_STATE` env,
  GST-inclusive back-calc, `SUB/YYYY/NNNNN` series
- [x] Generated on capture in both verify route and webhook
- [x] `GET /api/billing/invoices` (list) + `GET /api/billing/invoices/[id]` (printable HTML download)

### 2.6 2FA/MFA for Admin Accounts (P1) — DONE
- [x] Installed `otpauth` + `qrcode`; `src/lib/twofactor.ts`
- [x] `twoFactorSecret`/`twoFactorEnabled` on User (batched migration, applied)
- [x] `/api/auth/2fa/setup` (secret+QR), `/api/auth/2fa/verify`, `/api/auth/2fa/disable`
- [x] Enforced at login (any user with 2FA on → `twoFactorRequired` step; login page handles it)
- [x] 2FA UI: `TwoFactorSettings` component on `/settings/security`; `/api/auth/me` exposes status

---

## Sprint 3 — UX & Loading States
> **Goal:** No blank screens, proper error feedback, accessible UI.

### 3.1 ⚡ Root + Section Loading/Error Files — DONE
- [x] `src/app/loading.tsx` (uses existing `PageLoading`)
- [x] `src/app/error.tsx` (error boundary + retry); `global-error.tsx` already existed
- [x] Section loaders: invoices, quotations, clients, employees, transactions, projects

### 3.2 ⚡ Toast Error Handling — CORE DONE
- [x] Toast system already existed (`src/components/Toast.tsx`, `ToastProvider` mounted in layout)
- [x] Main CRUD mutation paths surface toasts (clients, invoices, quotations already; employees added)
- [~] Full sweep of all 58 files' silent catches NOT done — most remaining are initial-load
  fetches; mutation error feedback (the user-facing win) is covered. Follow-up: blanket pass.

### 3.3 Accessibility Pass — CORE DONE
- [x] `aria-live="polite"` + `role="status"` on toast container (global)
- [x] `aria-label` on clients row action buttons (representative; most icon buttons already have `title`)
- [x] `role="alert"` on error banners (EmailVerificationBanner, error.tsx, form alerts)
- [~] Full ~50-button aria-label sweep + aria-invalid/aria-describedby on all forms + axe audit:
  follow-up. Icon buttons currently rely on `title` tooltips for partial coverage.

---

## Sprint 4 — Operational Readiness
> **Goal:** Billing emails, support channel, revenue visibility.

### 4.1 Trial / Billing Lifecycle Emails (P2)
- [x] Welcome email on signup — covered by the verification email (2.1)
- [x] "X days left" reminders at 7d/3d/1d — in `subscription-check` cron (TRIALING + trialEndsAt window)
- [x] Payment receipt email on capture (verify route)
- [x] Payment failed email with retry link (webhook FAILED → /checkout)
- [x] Subscription canceled confirmation (cancel route)
- [x] Templates in `src/lib/email.ts`; wired into state machine paths + cron

### 4.2 Customer-Facing Support Channel (P2) — DONE
- [x] `/support/new` public page (added to proxy PUBLIC_PATHS)
- [x] `POST /api/support/tickets` (public, rate-limited) → new `SupportTicket` model (migration applied)
- [x] Confirmation email to customer
- [x] "Contact Support" link on login page

### 4.3 SaaS Revenue Dashboard (P2, admin only) — DONE
- [x] `/admin/revenue` page (MRR, total revenue, active subs, trialing, conversion, churn, 6-mo trend, by-plan)
- [x] `GET /api/admin/revenue` — aggregates BillingPayment + Company
- [x] Added to admin sidebar (PlatformShell)

### 4.4 Refunds for Subscriptions (P2) — DONE
- [x] `POST /api/payments/refund` — Razorpay refund API, super-admin only, marks BillingPayment REFUNDED, audited
- [~] Admin console UI with approval flow: endpoint ready; UI button not added (follow-up)

### 4.5 Reminders Page Pagination — DONE
- [x] Client-side pagination on history tab (20/page) + API capped at `take: 500`

---

## Sprint 5 — Growth & Polish
> **Goal:** Self-serve upgrades, trial UX, API access.

### 5.1 Self-Serve Upgrade on `/plans` (P3) — DONE
- [x] Upgrade buttons on `/plans` → link to `/checkout?plan=...`
- [x] Current plan highlighted with "Your plan" badge
- [x] Handle proration (mid-cycle changes) — **policy: upgrades only, credit unused** (user-chosen)
  - `src/lib/proration.ts` — `computeProration()` credits `currentPrice × remainingDays/windowDays`
    (clamped 0..currentPrice), charge = `max(0, newPrice − credit)`. Downgrades/same price NOT
    prorated (take effect next renewal, no refund). `periodDays()`/`periodEnd()` helpers (monthly=30,
    yearly=365, one-time=0).
  - Schema: `Company.currentPeriodStart` + `currentPeriodEnd` (migration `2026-06-20-billing-period.sql`,
    applied to Neon, client regenerated). Window opened on capture in the verify route.
  - `create-order` computes the **authoritative** prorated amount server-side (never trusts client
    amount); validates `amount === expectedAmount`; stashes `proratedCredit` in notes. Razorpay 100-paise
    floor handled.
  - `GET /api/billing/proration?plan=` preview endpoint; `/checkout` shows full price, the credit line,
    and the prorated "amount payable now", and pays the prorated charge.
  - Tests: `tests/unit/proration.test.ts` (7/7) — half-cycle credit, downgrade no-op, elapsed window,
    negative-charge clamp, period helpers. `tsc` + full unit suite (41) green.
- [x] Price from DB, not hardcoded — **done in Sprint 7.4** (`formatPlanPrice()` + `/api/plans/public`)

### 5.2 Trial Countdown Banner (P3) — DONE
- [x] `TrialBanner` in AppShell: shows "X days left", dismiss-able, re-appears ≤3 days
- [x] Reads `/api/plan` for `subscriptionStatus` + `trialEndsAt`

### 5.3 Public API + API Key Issuance (P3) — DONE
- [x] `ApiKey` model (migration applied) — stores SHA-256 `keyHash` + display `keyPrefix`, never plaintext
- [x] `src/lib/api-keys.ts` (generate/hash/resolve); `POST /api/settings/api-keys` returns raw key once,
  `GET` lists, `DELETE /[id]` revokes
- [x] Key auth via `resolveApiKey` (Bearer header) on `/api/public/v1/clients` (sample endpoint),
  runs inside `runWithTenant` so data is company-scoped; rate-limited; `/api/public` is JWT-exempt in proxy
- [x] `/settings/api-keys` UI + quick-start docs; linked in Sidebar
- [~] "API Access" feature-flag gating not enforced on endpoints yet (follow-up)

### 5.4 SSO / SAML (P3) — DEFERRED
Research/enterprise item, disproportionate to this session. Recommendation: adopt `@boxyhq/saml-jackson`
or WorkOS rather than hand-rolling SAML; gate behind an enterprise feature flag. Not started.

### 5.5 Multi-Currency (P3) — DEFERRED
Large cross-cutting change (schema currency/fx fields, per-document conversion, rate source, reporting
rollups). `defaultCurrency` already exists on CompanySettings as the seam. Not started this session.

---

## Sprint 6 — Testing & Optimization
> **Goal:** Confidence in deployments, performance at scale.

### 6.1 Test Coverage — CORE DONE
- [x] Unit tests added (vitest, all green): `tests/unit/schemas.test.ts` (Zod edge cases),
  `twofactor.test.ts` (TOTP verify), `api-keys.test.ts` (hash/generate),
  `subscription-transitions.test.ts` (state machine). Existing `tests/api/isolation` +
  `tests/unit/tenant-scoping` cover RBAC/tenant isolation.
- [~] Full CRUD route tests + mock-Razorpay payment-flow tests: follow-up (need DB/HTTP harness).
  Pure-logic layer (validation, auth helpers, state machine, key hashing) is covered.

### 6.2 Prisma Select Optimization — AUDITED
- [x] Reviewed list `findMany`+`include` usages. List endpoints (clients, employees) already use
  bare `findMany`; invoices/quotations/credit-notes include line `items` which ARE returned in the
  response (necessary). New public API endpoint uses explicit `select`. No speculative refactor —
  current includes fetch data the response actually uses.

### 6.3 Prisma updatedAt Audit — DONE
- [x] Audited all models. `updatedAt` present on every mutable top-level entity. Absent only on
  append-only/log/line-item/join models (ActivityLog, AuditLog, *LineItem, SubscriptionPayment,
  VendorPayment, etc.) — by existing convention. New models (ApiKey, SupportTicket,
  SubscriptionInvoice) follow the same append-only pattern. No changes needed.

---

## Sprint 7 — Admin Plan Pricing & Payment Flow
> **Goal:** Super admin controls plan pricing/limits; prices flow to all pages; payment tested end-to-end.

### 7.1 Add `priceInPaise` + `billingPeriod` to PlanDefinition (P0) — DONE (migration pending apply)
- [x] Add `priceInPaise Int @default(0)` and `billingPeriod String @default("monthly")` to `PlanDefinition` in schema.prisma
- [x] Generate migration SQL via `prisma migrate diff` → `prisma/sql/2026-06-19-plan-pricing.sql` (apply via `db execute` — PENDING, denied by auto-mode classifier; run manually)
- [x] Update `getPlanDefinitions()` in `src/lib/plans-db.ts` to return `priceInPaise` + `billingPeriod`
- [x] Update `PlanDef` type in `src/lib/features.ts` to include `priceInPaise: number` and `billingPeriod: string`
- [x] Seed default prices: Free=0, Starter=49900 (₹499), Professional=99900 (₹999), Enterprise=249900 (₹2499) — seed UPDATEs in migration SQL + fallback values in `PLAN_DEFS`

### 7.2 Super Admin — Plan Pricing & Limits Editor (P0) — DONE
- [x] Update `/admin/plans` page to add editable fields:
  - Price in ₹ (number input, stored as paise — converts ₹↔paise on the fly)
  - Billing period dropdown (monthly / yearly / one-time)
  - Seat limit (already exists)
  - Feature toggles (already exists)
  - "Coming soon" toggle (already exists)
- [x] Update `PUT /api/admin/plans` to persist `priceInPaise` + `billingPeriod`
  (validates priceInPaise ≥ 0, billingPeriod against allowlist)
- [x] Show live preview of how the plan card will look on `/plans` (formatted ₹ price + period suffix + coming-soon/teaser)
- [x] Add validation: price ≥ 0, sensible billing period values (server clamps + allowlists; UI uses number min=0 + select)
- Verified end-to-end: GET returns seeded prices, PUT round-trip persists & reverts (Starter 499↔599, monthly↔yearly).

### 7.3 Super Admin — Free Plan Limit Customization (P0) — DONE
- [x] Add section on `/admin/plans` for the Free plan:
  - Free-access window (days) input — Free card only
  - Seat limit for free tier (existing maxUsers field, blank = ∞)
  - Feature toggles (existing pill toggles per category)
- [x] Add `trialDurationDays Int @default(90)` to `PlanDefinition`
- [x] Generate + apply migration `prisma/sql/2026-06-19-trial-duration.sql` (applied to Neon)
- [x] DB plumbing: `PlanDef.trialDurationDays`, `getPlanDefinitions()`, `getFreeTrialDurationDays()` helper, admin PUT persists+validates (≥0)
- [x] `/plans` countdown now uses Free plan's `trialDurationDays` (days) instead of `LAUNCH.freeMonths` (months); falls back to freeMonths if DB value absent
- [~] Signup + cron: intentionally NOT auto-enrolling signups into a hard TRIALING clock — launch copy is explicitly "no trial clock / no card", companies stay FREE. The DB-backed duration drives the soft /plans countdown. Cron's trial reminders key off absolute `trialEndsAt` (set only when a company actually enters TRIALING via the subscription state machine), so there's no hardcoded duration there to replace. Revisit if a hard trial clock is adopted post-launch.
- Verified: admin PUT changed Free 90→60 days, flowed to `/api/plans/public`; restored to 90. All three new admin fields render.

### 7.4 Pricing Flows to All Pages (P0) — DONE
- [x] `/plans` page: shows actual ₹ price from DB via shared `formatPlanPrice()` helper
  - Format: "₹999/mo", "₹9,999/yr", "Free" based on `priceInPaise` + `billingPeriod`
  - Upgrade buttons link to `/checkout?plan=...` (no amount in URL — checkout reads DB price)
- [x] `/checkout` page: fetches price from `/api/plans/public` (source of truth), ignores query `amount`
  - Shows plan name, formatted price, billing period; pay button disabled until price loads
- [x] `/api/payments/create-order`: validates `amount === planDef.priceInPaise`; rejects coming-soon/missing/<100
  - Verified: tampered amount → 400 "This plan isn't available for purchase" (coming-soon guard fires first during launch)
- [x] Landing page: pricing cards now render DB-backed `formatPlanPrice()` — verified ₹499/₹999/₹2,499/mo + Free
- [x] Shared `formatPlanPrice(priceInPaise, billingPeriod)` in `src/lib/features.ts` used by /plans, /landing, /checkout, /admin/plans (no drift)
- Signup plan selector: N/A — signup only offers the Free launch plan (paid are coming-soon).

### 7.5 Test Razorpay Payment End-to-End (P0) — PARTIAL (modal opens, card entry is manual)
- [x] Start dev server, navigate to `/plans`
- [x] Click "Upgrade" on a non-free plan → verify redirect to `/checkout` with correct plan+price
  - Temporarily un-coming-soon Professional; checkout shows ₹999/mo from DB (not URL)
- [x] Razorpay checkout modal opens with correct ₹999 amount + "Test Mode" ribbon
  - Fixed: receipt field exceeded 40 chars → truncated companyId (`co_${id.slice(-12)}_${ts}`)
  - Fixed: Razorpay auth 401 → user regenerated test keys after account approval
- [ ] Complete payment with Razorpay test card `4111 1111 1111 1111` — MANUAL (modal is cross-origin iframe)
- [ ] Verify: BillingPayment record created with CAPTURED status
- [ ] Verify: Company.subscriptionStatus transitions to ACTIVE
- [ ] Verify: Company.currentPlanId updated
- [ ] Verify: GST subscription invoice generated
- [ ] Verify: Payment receipt email sent (check logs)
- [ ] Test dismissed flow: open checkout, close modal → verify "Payment cancelled" message
- [ ] Test failure flow: use failing test card → verify error handling
- Coming-soon flags restored after test.

---

## Sprint 8 — ToS Enforcement & Remaining Follow-ups
> **Goal:** Lock compliance, wire deferred items, polish.

### 8.1 ToS Hard-Block for Grandfathered Users (P1) — DONE
- [x] ToS check added in `proxy.ts` (edge middleware, not withApi — better: single choke point,
  redirects page navs server-side). `tosAccepted` now carried in JWT (added to both JwtPayload
  interfaces; set in login/signup/reset-password/accept-tos). Grandfathered company users → 403
  `{tosRequired:true}` on APIs, 307 → `/accept-terms` on pages.
- [x] `POST /api/auth/accept-tos` — sets `tosAcceptedAt = now()` AND reissues the JWT cookie so the
  gate lifts immediately (no re-login needed)
- [x] `/accept-terms` interstitial page: ToS + Privacy links, checkbox, "I Accept" button → calls
  accept-tos then redirects to `/`
- [x] Gate allows `/accept-terms`, `/api/auth/*`, `/api/plan*` through
- [x] Client-side: global `window.fetch` interceptor in AuthProvider redirects on 403 `tosRequired`
- [x] **Bug found & fixed during testing**: platform staff (super admin/support) hit a redirect loop
  (ToS gate → /accept-terms → platform-staff guard → /admin → loop). Fixed by exempting
  `isPlatformStaff` from the ToS gate (ToS is a tenant-customer concept).
- Verified end-to-end via curl cookie-jar (gate→403, page→307, accept→200+reissue, re-access→200)
  + browser screenshot of the rendered page. `tsc` + `next build` green.

### 8.2 PUT Route Zod Validation (P1) — DONE
- [x] Added `.partial()` update schemas to `src/lib/schemas/index.ts` (clientUpdateSchema, …) — all
  fields optional so partial updates pass, but malformed values still rejected
- [x] Wired validate-as-gate into all 11 PUT handlers (clients, invoices, quotations, employees,
  vendors, salary, projects, catalog, transactions, credit-notes, recurring-invoices `[id]` routes)
- [x] Return structured 400 with `fieldErrors` (same `parse()` helper + `!` pattern as POST)
- Verified: valid PUT→200; bad email→400 `{fieldErrors:{email}}`; empty businessName→400; negative
  rate→400. Gate-only (matches POST): raw typed body still flows to Prisma — string-number coercion
  to Prisma is a separate pre-existing concern (POST 500s identically; frontend sends typed values).

### 8.3 API Access Feature-Flag Gating (P1) — DONE
- [x] Enforce `checkFeatureAccess(companyId, "api-access")` on:
  - `POST /api/settings/api-keys` (key creation) — checks `requireCompanyId()` before generating
  - `GET /api/public/v1/clients` (key auth resolves company, then check flag, after rate-limit)
- [x] Return 403 with "API Access is not included in your plan" message
- Note: feature key is `api-access` (from `features.ts` registry). GET listing of existing keys
  left ungated so a downgraded company can still see/revoke keys; only creation + public use gated.
  `tsc` clean.

### 8.4 Refund Admin UI (P2) — DONE
- [x] Added "Billing" tab on `/admin/companies/[id]` listing this company's BillingPayments
  (amount, plan, status badge, date, razorpay payment id). API GET now returns `payments` (last 50).
- [x] Refund button shown only for `CAPTURED` payments; `confirm()` dialog with formatted amount
- [x] Calls `POST /api/payments/refund` (full refund), shows success/error banner, reloads on success
- Note: full-refund only (matches existing endpoint default); per-amount partial refund not exposed in UI.

### 8.5 ⚡ Toast Error Handling Sweep (P2) — DONE (mutation paths)
- [x] Audited mutation handlers (POST/PUT/DELETE) across list pages for silent/unhandled catches
- [x] Added `toast.error`/`toast.success` on previously-silent or unhandled mutations:
  vouchers (delete), payment-receipts (delete), clients (status change), quotations (status change),
  recurring-invoices (delete + toggle, were unhandled), settings/workflows (delete + toggle, were `alert()`),
  projects (create, was `/* handled */`), catalog (create/update/delete, were unhandled)
- [x] Left silent catches on initial-load fetches (`.catch(()=>{})`) — non-blocking, by design
- Note: `*/new` form pages and gst-report sub-pages surface their own inline error states; not converted.
  `tsc` clean.

### 8.6 ⚡ Accessibility Sweep (P2) — CORE DONE
- [x] `aria-label` added to icon-only action buttons/links on the high-traffic list pages:
  invoices (5), quotations (5), vendors (3), employees (2), transactions (1), projects (1).
  Each keeps its `title` tooltip + now exposes an explicit accessible name. (clients already done in 3.3)
- [~] `aria-invalid` + `aria-describedby` on form inputs with validation errors — NOT done; forms
  currently surface errors via toast/inline banners rather than per-field ARIA. Larger follow-up.
- [~] axe audit on key pages — requires browser harness; not run in this session. `tsc` clean.

### 8.7 Metered Resource Enforcement (P2) — DEFERRED BY DESIGN
- [~] No per-month metered caps exist in the product. Plan differentiation is **feature-based**
  (module on/off via `featureOverrides`) + **seat-based** (`maxUsers`, enforced in 1.3), not
  volume-based. Launch copy promises unlimited usage within a plan's enabled features, so adding
  an invoice/month cap would invent product policy not yet decided.
- [x] Enforcement seam is ready: `checkSeatLimit` (live) + `checkFeatureAccess` (live, used by 8.3).
  Feature-gated modules already block at the route/UI layer via `isModuleEnabled`/`PermissionGate`.
- Revisit only if a usage-quota tier is introduced post-launch; wire counts against a new
  `PlanDefinition.monthlyInvoiceCap`-style field then.

### 8.8 Integration Tests (P3) — DONE
- [x] Full CRUD route tests: `tests/api/crud-lifecycle.test.ts` — client create→list→get→update→delete
  + vendor create→update→delete + Zod 400 gate, against the HTTP API (skips if dev server down,
  same harness pattern as the isolation suite)
- [x] Mock-Razorpay payment flow test: `tests/unit/razorpay-signature.test.ts` — forges the exact
  HMAC checkout + webhook signatures Razorpay would send, asserts the verifier accepts valid and
  rejects every tamper (order/payment swap, wrong secret, altered body). 7/7 green, no network.
- [x] Tenant isolation integration test: already shipped (`tests/api/isolation.test.ts`, from 6.1) —
  cross-tenant list/read/update/delete denial + per-company numbering + platform-API 403s.

---

## Sprint 9 — Security Hardening (audit remediation, 2026-06-20)
> Full end-to-end security audit run. **Core multi-tenant isolation verified sound** (ALS + Prisma
> extension; cross-tenant findUnique/update/delete proven blocked via real-DB tests). The following
> Medium/Low findings were all fixed. Build + 41 unit tests green.

### Medium
- [x] **M1 — Bulk export admin-gated.** `GET /api/settings/export-data` now requires
  `x-user-system-admin === "true"` (was reachable by anyone with coarse `settings:view`; it dumps
  payroll + financials).
- [x] **M2 — Refund endpoint reachable.** Moved `POST /api/payments/refund` →
  `POST /api/admin/payments/refund` (the proxy blocks platform staff from non-`/api/admin` company
  APIs, so the SUPER_ADMIN-only refund was previously unreachable). UI fetch in
  `/admin/companies/[id]` updated.
- [x] **M3 — Security headers.** `next.config.ts` now sets CSP, HSTS, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy on all responses (CSP allows Razorpay
  checkout iframe/CDN + Sentry ingest).
- [x] **M4 — Distributed rate limiter.** `src/lib/rate-limit.ts` is now async with an Upstash-REST
  backend (fixed-window, no new dep, fail-open) + in-memory fallback. All 8 call sites awaited.
  New optional env: `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (in `.env.example`).
- [x] **M5 — `BillingPayment` auto-scoped.** Added to `TENANT_MODELS` in `db.ts`; verify-route
  comment corrected (all scoped reads run inside tenant context; webhook/cron/admin use unscoped).

### Low
- [x] **L1 — Invoice HTML XSS.** `GET /api/billing/invoices/[id]` HTML-escapes user-controlled fields
  (businessName, GSTIN, place of supply, SAC).
- [x] **L2 — Error leakage.** `withApi` + 76 per-route 500 handlers (40 files) now return a generic
  "Internal server error"; full detail still logged server-side.
- [x] **L3 — Session consistency.** Aligned dead-code `signJwtEdge` to 24h (matches `signJwt`); no
  7d token is ever minted.
- [x] **L4 — Login enumeration.** "Deactivated"/"company disabled" messages moved to *after* password
  verification, so they can't enumerate accounts.
- [x] **L5 — Cron secret header-only.** Removed `?secret=` query-param acceptance from all 4 cron
  routes (Vercel Cron sends the `Authorization: Bearer` header).

### Post-audit follow-ups (the two "not code-fixable here" items — now done)
- [x] **JWT session revocation.** Added `User.tokenVersion` (migration `2026-06-20-token-version.sql`,
  applied). The version is embedded in every JWT and re-checked per API request in `withApi`
  (cached 60s; legacy tokens without the claim are skipped until 24h expiry). Bumped on: password
  reset (both flows), role **permission** change (`revokeRoleSessions`), user role-change/deactivate
  (`revokeUserSessions`), and platform admin deactivate/force-reset. Helpers + cache live in
  `with-api.ts`. This closes the "stale permissions baked into JWT" gap — a role/permission change
  now forces affected users to re-auth within ~60s instead of waiting out the token.
- [x] **Secret scrubbed from docs.** Removed the plaintext Razorpay test KEY_SECRET (and key ids)
  from `SPRINT.md`; the doc now references the dashboard/`.env` only. **Action for the owner: rotate
  that test secret** since it previously sat in plaintext.

---

## Credentials Reference 🔒

> **Secrets do NOT live in this doc.** The real Razorpay test values are stored only in
> `.env` (local) and the deploy host's secret store (Vercel env vars). This table lists the
> variable names and where to paste each — fetch the actual values from your Razorpay dashboard.

| Variable | Value | Scope |
|----------|-------|-------|
| `RAZORPAY_KEY_ID` | `rzp_test_…` (from Razorpay dashboard) | Server |
| `RAZORPAY_KEY_SECRET` | `…` (from Razorpay dashboard) | Server only |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | same as `RAZORPAY_KEY_ID` | Client (public) |

These are **test keys**. Replace with live keys before production launch. **Rotate the old
test key secret** that was previously written here, since it lived in plaintext in this file.

---

## Definition of Done (per item)

1. Code written and `tsc` clean
2. `next build` passes
3. Tested in browser (for UI) or via API call (for endpoints)
4. Migration SQL generated (if schema changed) — **never `migrate dev`**
5. Item checked off in this file

---

## Session Start Template

Paste this at the start of each new Claude Code session:

```
Continue from SPRINT.md — pick up the next unchecked item in the current sprint.
Rules:
- Follow migrate-diff-only: generate SQL via `prisma migrate diff`, never `migrate dev`
- Never commit .env or secrets
- Check items off in SPRINT.md as you complete them
- Quick ⚡ items can run in parallel with the main task
- npm commands MUST use: npm_config_cache=/e/npm-cache TMPDIR=/e/tmp TEMP=/e/tmp TMP=/e/tmp
```
