import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/~offline",
  },
});

const mediaHost = (() => {
  const raw = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.r2.dev" },
      ...(mediaHost ? [{ protocol: "https" as const, hostname: mediaHost }] : []),
    ],
  },
  async rewrites() {
    const raw =
      process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const trimmed = raw.trim().replace(/\/$/, "");
    const backendUrl =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    const normalized = backendUrl;
    const apiHost = normalized.endsWith('/api')
      ? normalized.slice(0, -4)
      : normalized;
    return {
      afterFiles: [
        // Let /api/songs, /api/users, and /api/discovery be handled by App Route handlers
        // (they use runtime BACKEND_URL and support multipart upload streaming).
        { source: "/api/songs", destination: "/api/songs" },
        { source: "/api/songs/:path*", destination: "/api/songs/:path*" },
        { source: "/api/users", destination: "/api/users" },
        { source: "/api/users/:path*", destination: "/api/users/:path*" },
        { source: "/api/discovery", destination: "/api/discovery" },
        { source: "/api/discovery/:path*", destination: "/api/discovery/:path*" },
        { source: "/api/analytics", destination: "/api/analytics" },
        { source: "/api/analytics/:path*", destination: "/api/analytics/:path*" },
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
