import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Baseline security headers applied to every response. CSP is intentionally
// permissive on script-src for Next's inline runtime + the Razorpay checkout
// widget; tighten with nonces if the app moves off inline bootstrapping.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js injects inline bootstrap scripts; Razorpay checkout is loaded from their CDN.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // API calls + Razorpay + Sentry ingestion + UploadThing (file uploads go
      // directly from the browser to UploadThing's regional ingest host).
      "connect-src 'self' https://*.razorpay.com https://*.sentry.io https://*.ingest.sentry.io https://*.uploadthing.com https://*.ufs.sh https://utfs.io blob:",
      // Razorpay renders its checkout in an iframe; UploadThing files (PDF preview).
      "frame-src 'self' https://*.razorpay.com https://api.razorpay.com https://*.ufs.sh https://utfs.io",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // @prisma/client (classic generator) is auto-externalized by Next and its
  // engine binary is traced into serverless functions automatically.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Wrap with Sentry. Source-map upload only runs when SENTRY_AUTH_TOKEN (+ org/
// project) are set in CI; locally and without a DSN this is effectively a no-op.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  // Avoid uploading source maps unless an auth token is present.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
