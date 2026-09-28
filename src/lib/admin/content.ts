/** Content rules shared by the admin CMS and the storefront (pure). */

/** Policy pages linked from the footer and checkout: they can't be renamed or deleted. */
export const POLICY_SLUGS = ["terms", "privacy", "buyer-protection"];

/** Top-level paths that already belong to app routes, so a CMS page can't take them. */
export const RESERVED_PAGE_SLUGS = [
  "account",
  "admin",
  "api",
  "art",
  "artisans",
  "cart",
  "category",
  "checkout",
  "collections",
  "compare",
  "custom",
  "drops",
  "haveli",
  "how-importing-works",
  "journal",
  "lab",
  "login",
  "media",
  "product",
  "r",
  "register",
  "search",
  "seller",
  "shop",
  "wishlist",
];

export type WindowState = "live" | "scheduled" | "ended" | "off";

/** Whether a banner (or anything with an on switch and a date window) is showing now. */
export function windowState(a: { isActive: boolean; startsAt: Date | null; endsAt: Date | null }, now = new Date()): WindowState {
  if (!a.isActive) return "off";
  if (a.endsAt && a.endsAt <= now) return "ended";
  if (a.startsAt && a.startsAt > now) return "scheduled";
  return "live";
}

export type PostState = "draft" | "scheduled" | "published";

/** A published journal post with a future date is scheduled: hidden until then. */
export function postState(p: { status: string; publishedAt: Date | null }, now = new Date()): PostState {
  if (p.status !== "published") return "draft";
  return p.publishedAt && p.publishedAt > now ? "scheduled" : "published";
}
