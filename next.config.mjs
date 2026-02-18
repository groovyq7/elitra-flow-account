/** @type {import('next').NextConfig} */
const nextConfig = {
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