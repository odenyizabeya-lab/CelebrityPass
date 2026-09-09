import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", ".prisma/client", "prisma"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
