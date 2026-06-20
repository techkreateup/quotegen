# QuoteGen — SaaS Launch Readiness (Software Gaps)

What the *software* still needs before this can run as a paid, public SaaS.
Infra/ops items live in `PRODUCTION_CHECKLIST.md`; this file is about product features.
Status reflects code as of 2026-06-17.

## P0 — Blockers (cannot operate a paid SaaS without these)

- [ ] **Billing / payment integration.** There is **no payment gateway** (no Razorpay/Stripe,
      no checkout, no webhooks). Plans are "coming soon" and signup forces the Free launch plan,
      so today there is *no way to collect money*. Needed:
  - Payment gateway (Razorpay recommended for India + GST invoicing).
  - Webhooks for payment success/failure/refund → update subscription state.
  - Store subscription status on `Company` (trialing / active / past_due / canceled).
- [ ] **Subscription lifecycle / state machine.** Define what happens when the 3-month free
      period ends (auto-downgrade to a limited free tier, or lock with a grace period). Handle
      upgrade, downgrade, cancel, proration, and dunning (failed-payment retries).
- [ ] **Plan limit enforcement.** `Company.maxUsers` is editable in admin but **never enforced** —
      the user-create route does not check it, so any company can exceed its plan. Enforce seat
      limits server-side at user creation, and gate any other metered resources. (Feature gating
      itself already works via `feature-gate.ts`.)

## P1 — Trust / legal / security (before public signups)

- [ ] **Email verification on signup.** Users are created `isActive: true` with an unverified
      email → fake accounts and deliverability risk. Add a verify-email step.
- [ ] **Terms of Service + Privacy Policy acceptance** at signup (checkbox + stored timestamp).
- [ ] **DPDP Act 2023 (India) compliance:** published privacy policy, consent record, and
      self-serve **data export** + **account/company deletion** ("right to erasure"). Today only
      super-admin exports exist — tenants can't export or delete their own data.
- [ ] **GST-compliant invoices for your own subscription charges** (you sell to Indian businesses).
- [ ] **2FA/MFA** for accounts (at minimum for COMPANY_ADMIN and platform staff).

## P2 — Operational readiness

- [ ] **Trial / billing lifecycle emails** (welcome, "X days left in free period", payment receipt,
      payment failed). Inactivity nudges already exist; billing emails do not.
- [ ] **Inbound customer support channel.** Internal support-issue tracking exists, but there is no
      customer-facing way to open a ticket (support email or in-app form).
- [ ] **SaaS revenue dashboards** (MRR, churn, trial→paid conversion, active subscriptions).
      Current admin reports cover tenants' *business* metrics, not *your* SaaS revenue.
- [ ] **Refunds / credit notes / invoice history** for subscriptions in the admin console.
- [ ] **Status page + uptime monitoring + alerting** (see PRODUCTION_CHECKLIST.md).

## P3 — Growth / polish (fast-follow)

- [ ] Self-serve upgrade with payment on the existing `/plans` page (page exists, can't transact yet).
- [ ] In-app trial countdown banner.
- [ ] **Public API**: there's an "API Access" feature flag but no API-key issuance, scoping, or docs.
- [ ] SSO (SAML/OIDC) for enterprise; multi-currency (currently a premium flag, not implemented).
- [ ] Referral / coupon / discount codes.

## Already done ✅

- Multi-tenant isolation (companyId scoping), platform roles, super-admin console.
- Per-company + per-plan feature flags with server-side enforcement.
- Audit logging with tenant-wide retention, expiry indicators, and CSV export (tenant + admin).
- Rate limiting, CSRF/origin checks, 24h JWT, bcrypt-12, Sentry wiring.
- Inactivity re-engagement (in-app + email + WhatsApp) with cron.
- Storage retention crons (audit + usage events).
