/** Paths under /brands that a brand slug must never take (static storefront pages win over /brands/[slug]). */
export const RESERVED_BRAND_SLUGS = new Set(["shop", "bag", "checkout", "request", "order-placed", "art", "join", "directory", "partner-links"]);
