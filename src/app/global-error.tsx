"use client";

// App Router global error boundary. This is the correct place to wire Sentry's
// error reporting for the App Router (a server-component layout.tsx cannot host
// a client error boundary). Captures the error, then renders a minimal fallback.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-500">
            An unexpected error occurred and has been reported. Please try again.
          </p>
          <button
            onClick={() => reset()}
            className="mt-4 h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
