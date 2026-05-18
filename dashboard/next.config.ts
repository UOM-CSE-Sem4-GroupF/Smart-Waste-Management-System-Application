import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      // /api/v1/ → app/api/v1/[...path]/route.ts (server-side clean proxy, no rewrites).
      // /data-analysis/ → app/data-analysis/[...path]/route.ts (server-side clean proxy, no rewrites).
      {
        source: '/auth/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
