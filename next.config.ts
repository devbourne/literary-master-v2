import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  // Allow dev access from the LAN IP so Turbopack's HMR WebSocket connects
  // when the browser opens 192.168.x.x:3001 instead of localhost:3001.
  // The HMR socket origin must match the page origin or the upgrade is blocked.
  allowedDevOrigins: ["192.168.0.201", "localhost", "127.0.0.1"],
  outputFileTracingExcludes: {
    "/*": ["data/**/*", "literary-master_v*.md"],
  },
};

export default nextConfig;
