// Sentry initialization for the Node.js server runtime.
// Loaded from src/instrumentation.ts. No-op (with a warning in production) when
// SENTRY_DSN is not configured, so local/dev never depends on Sentry.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === "production",
  });
} else if (process.env.NODE_ENV === "production") {
  console.warn("[sentry] SENTRY_DSN is not set — server error monitoring is disabled.");
}
