// Sentry initialization for the Edge runtime (middleware/proxy, edge routes).
// Loaded from src/instrumentation.ts.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === "production",
  });
} else if (process.env.NODE_ENV === "production") {
  console.warn("[sentry] SENTRY_DSN is not set — edge error monitoring is disabled.");
}
