// Sentry initialization for the browser. The DSN must be exposed to the client
// bundle, so it reads NEXT_PUBLIC_SENTRY_DSN (falling back to SENTRY_DSN if that
// happens to be inlined at build time). No-op when unset.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    enabled: process.env.NODE_ENV === "production",
  });
} else if (process.env.NODE_ENV === "production") {
  console.warn("[sentry] NEXT_PUBLIC_SENTRY_DSN is not set — client error monitoring is disabled.");
}
