import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

function apiOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:13001").origin;
  } catch {
    return "http://localhost:13001";
  }
}

/** Tighter CSP for VaultOps + Clerk + Sentry + API. Adjust hostnames per env. */
function contentSecurityPolicy(): string {
  const api = apiOrigin();
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // Next + Clerk require inline/eval in practice for widget scripts
    [
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "https://*.clerk.accounts.dev",
      "https://*.clerk.com",
      "https://challenges.cloudflare.com",
    ].join(" "),
    ["style-src 'self' 'unsafe-inline'", "https://*.clerk.accounts.dev", "https://*.clerk.com"].join(
      " ",
    ),
    ["img-src 'self' data: blob:", "https://*.clerk.com", "https://img.clerk.com"].join(" "),
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      api,
      "https://*.clerk.accounts.dev",
      "https://*.clerk.com",
      "https://*.ingest.sentry.io",
      "https://*.ingest.de.sentry.io",
    ].join(" "),
    [
      "frame-src 'self'",
      "https://*.clerk.accounts.dev",
      "https://*.clerk.com",
      "https://challenges.cloudflare.com",
    ].join(" "),
    "worker-src 'self' blob:",
  ];
  return directives.join("; ");
}

const nextConfig: NextConfig = {
  transpilePackages: ["@vaultops/shared"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
        ],
      },
    ];
  },
};

const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN?.trim());

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: {
    disable: !uploadSourceMaps,
  },
  widenClientFileUpload: false,
  disableLogger: true,
});
