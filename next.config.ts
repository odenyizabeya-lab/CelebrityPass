import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", ".prisma/client", "prisma"],
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Prisma connects through Supabase's pooled URL (connection_limit=1) during
    // static generation. A single build worker serializes all prerender queries
    // on that one connection, so builds never hit pool timeouts (P2024).
    cpus: 1,
  },
};

export default nextConfig;
