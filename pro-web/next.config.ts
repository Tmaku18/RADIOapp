import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import path from "path";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/~offline",
  },
});

const nextConfig: NextConfig = {
  turbopack: {},
  outputFileTracingRoot: path.join(__dirname, ".."),
  async rewrites() {
    const raw =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:3000";
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
        // Let /api/discovery be handled by App Route handler
        // (uses runtime BACKEND_URL and multipart upload streaming).
        { source: "/api/discovery", destination: "/api/discovery" },
        { source: "/api/discovery/:path*", destination: "/api/discovery/:path*" },
        {
          source: "/api/:path*",
          destination: `${apiHost}/api/:path*`,
        },
      ],
    };
  },
};

export default withPWA(nextConfig);
