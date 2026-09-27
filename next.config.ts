import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM Postgres build; keep it (and the postgres driver) out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  images: {
    // Uploaded media is served by our own /media route; artwork by /art.
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/art/**" }, { pathname: "/demo/**" }, { pathname: "/brand/**" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
