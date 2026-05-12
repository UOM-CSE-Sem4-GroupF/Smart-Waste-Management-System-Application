import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/:path*`,
      },
      {
        source: '/data-analysis/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/data-analysis/:path*`,
      },
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
