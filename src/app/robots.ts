import type { MetadataRoute } from "next";
import { isDemoMode } from "@/lib/settings";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  // A site running on sample artisans and reviews must never be indexed.
  if (isDemoMode()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/seller", "/account", "/checkout", "/cart", "/api", "/lab"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
