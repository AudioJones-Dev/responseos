import type { NextConfig } from "next";

/**
 * Security headers for the public demo deploy (D6, gap doc
 * docs/GTM_GAP_AND_DEPLOYMENT_PLAN.md). Conservative, host-agnostic defaults;
 * tune per compliance lane at go-live. Applied to every route.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework.
  poweredByHeader: false,
  // Self-contained server output for the hosted/containerized demo deploy.
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
