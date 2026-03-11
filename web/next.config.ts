import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/~offline",
  },
});

const nextConfig: NextConfig = {
  turbopack: {},
  async rewrites() {
    const raw =
      process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const backendUrl =
      raw.startsWith("http://") || raw.startsWith("https://")
        ? raw
        : "http://localhost:3000";
    const normalized = backendUrl.replace(/\/$/, '');
    const apiHost = normalized.endsWith('/api')
      ? normalized.slice(0, -4)
      : normalized;
    return {
      afterFiles: [
        // Let /api/songs and /api/users be handled by App Route handlers (they use runtime BACKEND_URL)
        { source: "/api/songs", destination: "/api/songs" },
        { source: "/api/songs/:path*", destination: "/api/songs/:path*" },
        { source: "/api/users", destination: "/api/users" },
        { source: "/api/users/:path*", destination: "/api/users/:path*" },
        // All other /api/* go to the backend
        {
          source: "/api/:path*",
          destination: `${apiHost}/api/:path*`,
        },
      ],
    };
  },
};

export default withPWA(nextConfig);
