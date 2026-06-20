# QuoteGen — Production Readiness Checklist

A pre-launch checklist for the multi-tenant SaaS deployment. Work top to bottom;
nothing here is destructive, but several items depend on external account access.

## Database (Neon)

- [ ] **Apply pending migrations** (run these against the production DB):
  - `npx prisma db execute --file prisma/sql/2026-06-17-platform-settings.sql --schema prisma/schema.prisma`
  - `npx prisma db execute --file prisma/sql/2026-06-17-indexes.sql --schema prisma/schema.prisma`
  - _(Optional cleanup)_ the legacy `AuditLog_companyId_idx` is now redundant with `idx_audit_company` and may be dropped.
- [ ] **Use the pooled connection string** — set `DATABASE_URL` to Neon's `-pooler` host
      with `?sslmode=require&connection_limit=10&pgbouncer=true`. Set `DIRECT_URL` to the
      non-pooled host (migrations only). See the datasource comment in `prisma/schema.prisma`.
- [ ] **Enable Point-in-Time Recovery (PITR)** / backups in the Neon console.
- [ ] **Pick the right region** — host the DB in the region closest to your users
      (data residency: see Data Privacy below) and co-locate Vercel functions there.
- [ ] _(Deferred)_ Neon plan upgrade — revisit once usage grows.

## Hosting (Vercel)

- [ ] **Set environment variables** (Project → Settings → Environment Variables):
  - `JWT_SECRET` — long random string (required in production; the app throws if missing).
  - `DATABASE_URL`, `DIRECT_URL` — see Database above.
  - `SENTRY_DSN` — server/edge error reporting (warns and no-ops if unset).
  - `NEXT_PUBLIC_SENTRY_DSN` — browser error reporting (must be the `NEXT_PUBLIC_` form to reach the client bundle).
  - `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — only needed for source-map upload in CI.
  - `CRON_SECRET` — gates `/api/cron/*` (nudge-inactive, audit-cleanup).
  - `EMAIL_FROM` — verified sender for Resend.
  - `RESEND_API_KEY` — Resend API key.
  - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` — WhatsApp Cloud API (optional; dev-logs if unset).
  - `ALLOWED_ORIGIN` — production origin for CORS/CSRF allow-listing (e.g. `https://app.quotegen.com`).
  - `APP_URL` — public base URL used in password-reset links.
- [ ] **Verify cron jobs** are registered from `vercel.json`:
  - `/api/cron/nudge-inactive?days=30` — Mondays 09:00 UTC.
  - `/api/cron/audit-cleanup` — daily 03:00 UTC.
- [ ] _(Deferred)_ Vercel plan upgrade — revisit when concurrency/limits require it.

## Email (Resend)

- [ ] **Verify the sending domain** at resend.com (add the DKIM/SPF DNS records).
- [ ] Set `EMAIL_FROM` to an address on the verified domain.
- [ ] Send a live test (password reset / inactive nudge) and confirm delivery.

## WhatsApp

- [ ] _(Deferred)_ Meta Business verification + Cloud API setup. Until then the
      integration safely logs in dev/no-ops; set `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID`
      later to enable real delivery.

## Security

- [x] Rate limiting on login (5/15m), signup (5/15m), password reset (3/h).
- [x] bcrypt cost factor 12.
- [x] JWT session capped at 24h.
- [x] CSRF/cross-origin rejection on state-changing API requests in production (`ALLOWED_ORIGIN`).
- [ ] Confirm `JWT_SECRET` is set and unique to production (not the dev fallback).
- [ ] Review who has `SUPER_ADMIN` / `SUPPORT` platform roles.

## Observability / Uptime

- [ ] Confirm Sentry receives a test error (trigger once after deploy).
- [ ] **Set up uptime monitoring** — an external pinger (e.g. against `/landing` or a
      lightweight health route) with alerting to email/Slack.
- [ ] Add alerting on Sentry error-rate spikes.

## Data Privacy

- [ ] **Choose the Neon region** to satisfy data-residency expectations of your customers.
- [ ] **Publish a privacy policy** covering what tenant data is stored (GSTIN, PAN, bank
      details, contacts), retention (audit logs auto-delete on the configured window),
      and how export/deletion requests are handled.
- [ ] Document the audit-log retention setting (super admin → Settings → Audit & data retention).
