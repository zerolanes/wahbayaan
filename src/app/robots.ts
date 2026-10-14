import type { MetadataRoute } from "next";
import { isDemoMode } from "@/lib/settings";
import { siteUrl } from "@/lib/seo";

// Decided per request: DEMO_MODE at run time, not at build time.
export const dynamic = "force-dynamic";

/** Private and per-visitor areas: never crawled (and never in the sitemap). */
export const ROBOTS_DISALLOW = [
  "/admin",
  "/seller",
  "/brand-portal",
  "/account",
  "/checkout",
  "/cart",
  "/wishlist",
  "/compare",
  "/search",
  "/brands/bag",
  "/brands/checkout",
  "/brands/order-placed",
  "/labels",
  "/outreach",
  "/preview",
  "/r/",
  "/api",
  "/lab",
];

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  // A site running on sample artisans and reviews must never be indexed.
  if (isDemoMode()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ROBOTS_DISALLOW }],
    sitemap: `${base}/sitemap.xml`,
  };
}
