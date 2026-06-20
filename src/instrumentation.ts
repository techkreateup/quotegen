import * as Sentry from "@sentry/nextjs";

// Loads the runtime-appropriate Sentry init (server or edge) once per server
// instance. The config files no-op when SENTRY_DSN is unset.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Forwards server-side request errors (RSC, route handlers, actions) to Sentry.
export const onRequestError = Sentry.captureRequestError;
