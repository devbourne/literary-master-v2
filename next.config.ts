import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  outputFileTracingExcludes: {
    "/*": ["data/**/*", "literary-master_v*.md"],
  },
};

export default nextConfig;
