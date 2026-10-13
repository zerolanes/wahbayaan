/**
 * 301 redirects from the old WordPress / WooCommerce site (wahbayaan.com), one
 * row per URL in `theme-source/LAYOUT.md` §7. Served by `next.config.ts`
 * `redirects()`, which runs before any page renders. Rows whose new path is the
 * same route (e.g. `/shop/` → `/shop`) need no rule: Next's trailing-slash
 * redirect already lands there. `tests/legacy-redirects.test.ts` checks that
 * every row is covered and every destination is a real route.
 *
 * Imported by next.config.ts, so keep this file free of `@/` imports.
 * Ad-hoc redirects the owner adds later belong in Admin → Redirects.
 */
export type LegacyRedirect = { from: string; to: string; note?: string };

const demoProducts = [
  "variable-product-example",
  "basic-contrast-sneakers",
  "basic-korean-style-coat",
  "black-umbrella-in-handle",
  "bold-metallic-watch",
  "eingerless-gloves-in-camel",
  "gthnic-detail-open-jacket",
  "jhecked-flannel-shirt",
  "curve",
  "grace",
  "reverse-withdrawal-payment",
  "hoodie",
];
const demoPosts = ["here-comes-autumn", "flowing-serpentines", "the-clean-series", "for-clear-thinking", "ethimo-mountain-style", "in-the-heart-of-valencia"];
const demoPortfolio = ["a-fusce-fringilla-scelerisque", "lectus-aptent-facilisis-habitasse", "varius-tempor-arcu-sociosqu"];
// `/category/furniture/` was a demo blog category; it is now a real craft page, so it is not redirected.
const blogCategories = ["decoration", "design-trends", "fashion", "inspiration", "lifestyle", "travel", "uncategorized", "wooden-accessories"];
const blogTags = ["bathroom", "chair", "furniture", "guide", "inspiration", "machine", "sofa", "style", "trends"];
const demoBrands = ["4mariani", "bitte", "elitis", "enza-home", "flos", "gan", "hay", "kettal", "lladro", "minotti"];

const sub = (parent: string, to: string, children: string[]) => children.map((c) => ({ from: `/product-category/${parent}/${c}`, to }));

export const LEGACY_REDIRECTS: LegacyRedirect[] = [
  // Pages
  { from: "/", to: "/" },
  { from: "/blog", to: "/journal" },
  { from: "/wishlist", to: "/wishlist" },
  { from: "/compare", to: "/compare" },
  { from: "/showrooms", to: "/contact", note: "demo page; visitors looking for a showroom can ask us" },
  { from: "/gift-cards", to: "/shop", note: "demo page; no gift cards yet" },
  { from: "/contact-us", to: "/contact" },
  { from: "/about-us", to: "/about" },
  { from: "/shop", to: "/shop" },
  { from: "/cart", to: "/cart" },
  { from: "/checkout", to: "/checkout" },
  { from: "/my-account", to: "/account" },
  { from: "/dashboard", to: "/seller" },
  { from: "/marketplace", to: "/artisans" },
  { from: "/my-orders", to: "/account/orders" },
  { from: "/store-manager", to: "/seller" },
  { from: "/seller-membership", to: "/become-a-seller" },
  { from: "/seller-register", to: "/become-a-seller" },
  { from: "/tracking", to: "/track" },
  { from: "/track-your-order", to: "/track" },
  { from: "/orders-tracking", to: "/track" },

  // Product categories
  { from: "/product-category/accessories", to: "/shop", note: "demo category" },
  { from: "/product-category/calligraphy-art", to: "/category/calligraphy-art" },
  { from: "/product-category/customize", to: "/category/bespoke" },
  { from: "/product-category/handmade-carpets", to: "/category/rugs" },
  { from: "/product-category/paintings", to: "/category/paintings" },
  { from: "/product-category/posters-prints", to: "/category/posters-prints" },
  { from: "/product-category/salt-art-decor", to: "/category/salt-art" },
  { from: "/product-category/stone-sculptures-taxila", to: "/category/sculpture-stone" },
  { from: "/product-category/wall-decor-accessories", to: "/category/wall-decor" },
  ...sub("calligraphy-art", "/category/calligraphy-art", ["islamic", "modern-abstract", "quranic-verses-ayats", "urdu-poetry"]),
  ...sub("handmade-carpets", "/category/rugs", ["abstract-modern-rugs", "custom-size-rugs", "kashmiri-handmade-carpets", "persian-carpets", "prayer-mats", "tribal-balochi-rugs", "wool-carpets"]),
  ...sub("paintings", "/category/paintings", ["abstract", "cultural-traditional", "figurative-potraits", "islamic-sufi-art", "miniature-art", "nature-landscapes"]),
  ...sub("posters-prints", "/category/posters-prints", ["cultural", "famous-personalities", "motivational-quotes", "pop-art", "vintage"]),
  ...sub("wall-decor-accessories", "/category/wall-decor", ["islamic-wall-clocks", "metal-art-pieces", "mirrors", "tapestry-wall-fabric", "wall-plates", "wooden-wall-hangings"]),

  // Demo products (no real catalogue on the old site)
  ...demoProducts.map((p) => ({ from: `/product/${p}`, to: "/shop", note: "demo product" })),

  // Blog posts, portfolio, blog categories and tags (all demo content)
  ...demoPosts.map((p) => ({ from: `/${p}`, to: "/journal", note: "demo post" })),
  ...demoPortfolio.map((p) => ({ from: `/portfolio/${p}`, to: "/collections", note: "demo portfolio item; closest curated listing" })),
  { from: "/category/furniture", to: "/category/furniture", note: "old demo blog category; now the real Heritage Furniture craft page" },
  ...blogCategories.map((c) => ({ from: `/category/${c}`, to: "/journal", note: "demo blog category" })),
  ...blogTags.map((t) => ({ from: `/tag/${t}`, to: "/journal", note: "demo blog tag" })),

  // WooCommerce demo brands (brand base unconfirmed)
  ...demoBrands.map((b) => ({ from: `/brand/${b}`, to: "/shop", note: "demo brand" })),

  // Broken footer links on the old site
  { from: "/product-category/furnitures", to: "/category/furniture" },
  { from: "/product-category/antique-art", to: "/shop", note: "never existed" },
  { from: "/product-category/customized", to: "/category/bespoke" },

  // Vendor stores (WCFM; slugs not in the export) — same slug when the artisan is listed here
  { from: "/store/:slug", to: "/artisans/:slug" },
  { from: "/store", to: "/artisans" },

  // Feeds and system
  { from: "/feed", to: "/journal" },
  { from: "/author/:login", to: "/artisans" },
];

/** Strip the trailing slash WordPress used (keeps "/"). */
export const normalizePath = (p: string) => p.replace(/\/+$/, "") || "/";

type NextRedirect = { source: string; destination: string; statusCode: 301; has?: { type: "query"; key: string; value?: string }[] };

/**
 * Rules for next.config.ts, as 301s. Old URLs ended in "/": Next first strips the
 * slash (308), then this rule applies (301) — two hops, which search engines follow.
 */
export function legacyRedirectRules(): NextRedirect[] {
  const rules: NextRedirect[] = LEGACY_REDIRECTS.filter((r) => normalizePath(r.from) !== normalizePath(r.to)).map((r) => ({ source: r.from, destination: r.to, statusCode: 301 as const }));
  // WordPress search: /?s=term → /search?q=term
  rules.push({ source: "/", has: [{ type: "query", key: "s", value: "(?<term>.*)" }], destination: "/search?q=:term", statusCode: 301 });
  return rules;
}
