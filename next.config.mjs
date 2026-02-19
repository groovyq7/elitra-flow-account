/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * HTTP Security Headers — applied to all routes.
   *
   * CORS for API routes: Next.js API routes are same-origin by default.
   * Our internal API routes (/api/graph, /api/apy, /api/protocols/*, /api/campaign/register)
   * are only called from the same origin (the Next.js frontend), so no explicit CORS
   * configuration is needed — the browser's same-origin policy provides the protection.
   *
   * Content-Security-Policy is intentionally omitted: Privy, PostHog, and the SpiceFlow SDK
   * load external scripts and iframes that would require a complex allowlist. Adding a
   * restrictive CSP without thorough testing would break the app. Add CSP once a proper
   * policy is audited and validated.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },

  experimental: {
    webpackMemoryOptimizations: true,
  },

  productionBrowserSourceMaps: false,

  async rewrites() {
    return [
      // SpiceNet TX Submission API proxy — avoids CORS in dev and production
      {
        source: "/api/relayer/:path*",
        destination: `${process.env.SPICENET_RELAYER_DESTINATION || "https://tx-submission-testnet.spicenet.io"}/:path*`,
      },
      {
        source: "/relay-Lq2w/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/relay-Lq2w/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig