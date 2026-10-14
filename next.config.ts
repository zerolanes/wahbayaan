import type { NextConfig } from "next";
import { legacyRedirectRules } from "./src/lib/legacy-redirects";

const nextConfig: NextConfig = {
  // No Next.js dev badge ("N" / issue chips) on customer-facing pages, even in development.
  devIndicators: false,
  // PGlite ships a WASM Postgres build; keep it (and the postgres driver) out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // Migrations are read at runtime on first database connection.
  outputFileTracingIncludes: { "/**": ["./drizzle/**"] },
  images: {
    // Uploaded media is served by our own /media route; artwork by /art.
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/art/**" }, { pathname: "/brand-art/**" }, { pathname: "/demo/**" }, { pathname: "/brand/**" }],
  },
  // 301s from the old WordPress site (theme-source/LAYOUT.md §7). One-off redirects live in Admin → Redirects.
  async redirects() {
    return legacyRedirectRules();
  },
  experimental: {
    serverActions: { bodySizeLimit: "60mb" },
  },
};

export default nextConfig;
