import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, dutyRates, fxRates, importRules, journalPosts, pages, products, shippingRates, vendors } from "@/lib/db/schema";
import { getSettings, isDemoMode } from "@/lib/settings";
import { activeProvider } from "@/lib/payments";
import { categoryIssues, findSharedBanners, productIssues, vendorIssues } from "@/lib/trust/visibility";
import { DESTINATIONS } from "@/lib/money/currency";
import { policyDraftMarkers, scanPlaceholderCopy, statusFromCount, type ReadinessItem } from "./readiness";
import { query } from "./sql";

const MAX_EXAMPLES = 6;

/** Live launch-readiness checklist computed from the database and environment. */
export async function getReadiness(): Promise<ReadinessItem[]> {
  const d = await db();
  const ctx = { demoMode: isDemoMode() };
  const [cats, vens, prods, imageStats, pageRows, journal, fx, ship, duty, rules, s, demoCounts] = await Promise.all([
    d.select().from(categories),
    d.select().from(vendors),
    d.select().from(products),
    query<{ product_id: string; n: number; illus: number }>(
      sql`select product_id, count(*)::int as n, count(*) filter (where kind = 'illustration')::int as illus from product_images group by product_id`,
    ),
    d.select().from(pages),
    d.select().from(journalPosts),
    d.select().from(fxRates),
    d.select().from(shippingRates),
    d.select().from(dutyRates),
    d.select().from(importRules),
    getSettings(["commission", "handling_fee", "gift_wrap", "escrow", "buyer_protection"]),
    query<{ t: string; n: number }>(sql`
      select 'products' as t, count(*)::int as n from products where is_demo
      union all select 'vendors', count(*)::int from vendors where is_demo
      union all select 'orders', count(*)::int from orders where is_demo
      union all select 'users', count(*)::int from users where is_demo`),
  ]);
  const imgs = new Map(imageStats.map((r) => [r.product_id, r]));
  const catById = new Map(cats.map((c) => [c.id, c]));
  const shared = findSharedBanners(vens);
  const items: ReadinessItem[] = [];
  const push = (i: ReadinessItem) => items.push({ ...i, examples: i.examples?.slice(0, MAX_EXAMPLES) });

  // ── Categories ──
  const noCover = cats.filter((c) => !c.coverImageUrl);
  push({
    id: "category_covers",
    group: "Categories",
    title: "Every category has a cover image",
    status: statusFromCount(noCover.length, "fail"),
    count: noCover.length,
    detail: noCover.length ? `${noCover.length} categor${noCover.length === 1 ? "y has" : "ies have"} no cover — they are hidden rather than shown as gray tiles.` : "All categories have covers.",
    href: "/admin/categories",
    fixLabel: "Upload covers",
    examples: noCover.map((c) => ({ label: c.name, href: `/admin/categories#${c.id}` })),
  });
  const illusCovers = cats.filter((c) => c.coverImageUrl && c.coverKind !== "photo");
  push({
    id: "category_photography",
    group: "Categories",
    title: "Category covers are real photography",
    status: statusFromCount(illusCovers.length, "warn"),
    count: illusCovers.length,
    detail: illusCovers.length ? `${illusCovers.length} categor${illusCovers.length === 1 ? "y uses" : "ies use"} an illustration cover. Replace with real photography before launch.` : "All covers are photographs.",
    href: "/admin/categories",
    fixLabel: "Replace covers",
    examples: illusCovers.map((c) => ({ label: c.name, href: `/admin/categories#${c.id}` })),
  });
  const hiddenCats = cats.filter((c) => categoryIssues(c, ctx).length > 0);
  push({
    id: "category_visibility",
    group: "Categories",
    title: "Categories visible on the storefront",
    status: statusFromCount(hiddenCats.length, "warn"),
    count: hiddenCats.length,
    detail: hiddenCats.length ? `${hiddenCats.length} of ${cats.length} categories would not show publicly.` : `All ${cats.length} categories are public.`,
    href: "/admin/categories",
    examples: hiddenCats.map((c) => ({ label: c.name, href: `/admin/categories#${c.id}`, reasons: categoryIssues(c, ctx).map((r) => r.message) })),
  });

  // ── Artisans ──
  const liveVendors = vens.filter((v) => v.status !== "rejected");
  const failing = liveVendors.filter((v) => vendorIssues(v, ctx, shared).length > 0);
  const verifiedFailing = failing.filter((v) => v.status === "verified");
  push({
    id: "artisan_guards",
    group: "Artisans",
    title: "Verified artisans pass the public-profile guards",
    status: verifiedFailing.length ? "fail" : failing.length ? "warn" : "pass",
    count: failing.length,
    detail: failing.length
      ? `${failing.length} artisan profile${failing.length === 1 ? " is" : "s are"} hidden from the storefront (${verifiedFailing.length} of them already verified).`
      : "Every artisan profile passes the guards.",
    href: "/admin/artisans?issues=1",
    fixLabel: "Review artisans",
    examples: failing.map((v) => ({ label: v.displayName, href: `/admin/artisans/${v.id}`, reasons: vendorIssues(v, ctx, shared).map((r) => r.message) })),
  });
  const sharedBannerVendors = vens.filter((v) => v.bannerUrl && shared.has(v.bannerUrl));
  push({
    id: "artisan_banners",
    group: "Artisans",
    title: "No two artisans share a template banner",
    status: statusFromCount(sharedBannerVendors.length, "fail"),
    count: sharedBannerVendors.length,
    detail: sharedBannerVendors.length ? `${sharedBannerVendors.length} artisans use a banner another artisan also uses.` : "Every banner is unique.",
    href: "/admin/artisans?issues=1",
    examples: sharedBannerVendors.map((v) => ({ label: v.displayName, href: `/admin/artisans/${v.id}` })),
  });
  const illusPhotos = vens.filter((v) => v.profilePhotoUrl && v.profilePhotoKind !== "photo");
  push({
    id: "artisan_photography",
    group: "Artisans",
    title: "Artisan profile photos are real photographs",
    status: statusFromCount(illusPhotos.length, "warn"),
    count: illusPhotos.length,
    detail: illusPhotos.length ? `${illusPhotos.length} artisan${illusPhotos.length === 1 ? "" : "s"} still show an illustrated portrait.` : "All profile photos are photographs.",
    href: "/admin/artisans",
    examples: illusPhotos.map((v) => ({ label: v.displayName, href: `/admin/artisans/${v.id}` })),
  });
  const verifiedCount = vens.filter((v) => v.status === "verified" && vendorIssues(v, ctx, shared).length === 0).length;
  push({
    id: "artisan_count",
    group: "Artisans",
    title: "At least one public, verified artisan",
    status: verifiedCount > 0 ? "pass" : "fail",
    count: verifiedCount,
    detail: `${verifiedCount} artisan${verifiedCount === 1 ? " is" : "s are"} public on the storefront.`,
    href: "/admin/artisans",
  });

  // ── Listings ──
  const active = prods.filter((p) => p.status === "active");
  const productProblems = active
    .map((p) => ({ p, issues: productIssues({ ...p, imageCount: imgs.get(p.id)?.n ?? 0 }, ctx) }))
    .filter((x) => x.issues.length);
  push({
    id: "listing_guards",
    group: "Listings",
    title: "Active listings pass the public-listing guards",
    status: statusFromCount(productProblems.length, "fail"),
    count: productProblems.length,
    detail: productProblems.length ? `${productProblems.length} active listing${productProblems.length === 1 ? " is" : "s are"} hidden (no images, placeholder copy or demo).` : `All ${active.length} active listings pass.`,
    href: "/admin/listings?issues=1",
    examples: productProblems.map(({ p, issues }) => ({ label: p.title, href: `/admin/listings/${p.id}`, reasons: issues.map((r) => r.message) })),
  });
  const illusListings = prods.filter((p) => p.status !== "archived" && (imgs.get(p.id)?.illus ?? 0) > 0);
  push({
    id: "listing_photography",
    group: "Listings",
    title: "Listing images are real photographs",
    status: statusFromCount(illusListings.length, "warn"),
    count: illusListings.length,
    detail: illusListings.length ? `${illusListings.length} listing${illusListings.length === 1 ? "" : "s"} still use illustrations.` : "No illustrations in listing galleries.",
    href: "/admin/listings?image=illustration",
    examples: illusListings.map((p) => ({ label: p.title, href: `/admin/listings/${p.id}` })),
  });
  const missingShipping = active.filter((p) => !p.weightG || !p.widthCm || !p.heightCm || !p.depthCm);
  push({
    id: "listing_weights",
    group: "Listings",
    title: "Active listings have weight and dimensions",
    status: statusFromCount(missingShipping.length, "fail"),
    count: missingShipping.length,
    detail: missingShipping.length ? `${missingShipping.length} listing${missingShipping.length === 1 ? " is" : "s are"} missing weight or dimensions — shipping can't be quoted automatically.` : "Every active listing can be quoted for shipping.",
    href: "/admin/listings?missing=shipping",
    examples: missingShipping.map((p) => ({ label: p.title, href: `/admin/listings/${p.id}`, reasons: [!p.weightG ? "No weight" : null, !p.widthCm || !p.heightCm || !p.depthCm ? "No dimensions" : null].filter(Boolean) as string[] })),
  });
  const missingHs = active.filter((p) => !p.hsCodeOverride && !catById.get(p.categoryId)?.hsCode);
  push({
    id: "listing_hs",
    group: "Listings",
    title: "Active listings have an HS code (listing or category)",
    status: statusFromCount(missingHs.length, "warn"),
    count: missingHs.length,
    detail: missingHs.length ? `${missingHs.length} listing${missingHs.length === 1 ? " has" : "s have"} no HS code for customs invoices.` : "Every active listing has an HS code.",
    href: "/admin/categories",
    fixLabel: "Set category HS codes",
    examples: missingHs.map((p) => ({ label: p.title, href: `/admin/listings/${p.id}` })),
  });

  // ── Cross-border rates ──
  const fxBad = ["USD", "GBP", "CAD"].filter((c) => {
    const r = fx.find((x) => x.currency === c);
    return !r || r.status === "placeholder" || !(Number(r.pkrPerUnit) > 0);
  });
  push({
    id: "fx",
    group: "Rates & fees",
    title: "Exchange rates are real (not placeholders)",
    status: statusFromCount(fxBad.length, "fail"),
    count: fxBad.length,
    detail: fxBad.length ? `${fxBad.join(", ")} ${fxBad.length === 1 ? "uses" : "use"} a placeholder or missing rate.` : "USD, GBP and CAD have manual or live rates.",
    href: "/admin/rates/fx",
    fixLabel: "Set rates",
  });
  const shipPending = ship.filter((r) => r.status === "pending" || r.amount == null);
  const destsWithoutShipping = DESTINATIONS.filter((dst) => !ship.some((r) => r.destinationCountry === dst.code && r.status === "active" && r.amount != null));
  push({
    id: "shipping",
    group: "Rates & fees",
    title: "Courier rates are entered for every destination",
    status: destsWithoutShipping.length ? "fail" : shipPending.length ? "warn" : "pass",
    count: shipPending.length,
    detail: destsWithoutShipping.length
      ? `No active courier rate for ${destsWithoutShipping.map((x) => x.name).join(", ")}. ${shipPending.length} of ${ship.length} rate rows pending.`
      : shipPending.length
        ? `${shipPending.length} of ${ship.length} rate rows still pending.`
        : "All rate rows are active.",
    href: "/admin/rates/shipping?status=pending",
    fixLabel: "Enter rates",
  });
  const dutyPending = duty.filter((r) => r.status === "pending" || r.dutyPercent == null);
  push({
    id: "duty",
    group: "Rates & fees",
    title: "Duty and import-tax rates confirmed by a customs broker",
    status: statusFromCount(dutyPending.length, "fail"),
    count: dutyPending.length,
    detail: dutyPending.length ? `${dutyPending.length} of ${duty.length} duty rows are pending.` : "All duty rows are confirmed.",
    href: "/admin/rates/duty?status=pending",
    fixLabel: "Enter duty rates",
  });
  const activeRules = rules.filter((r) => r.status === "active");
  push({
    id: "import_rules",
    group: "Rates & fees",
    title: "Import rules reviewed for each destination",
    status: DESTINATIONS.every((dst) => activeRules.some((r) => r.destinationCountry === dst.code)) ? "pass" : "warn",
    count: activeRules.length,
    detail: `${activeRules.length} active import rule${activeRules.length === 1 ? "" : "s"}. Buyers see “not reviewed yet” where none exist.`,
    href: "/admin/rates/rules",
  });
  const fees: [string, string, boolean, "fail" | "warn"][] = [
    ["commission", "Artisan commission is set", s.commission.status === "active", "fail"],
    ["handling_fee", "Handling fee decided", s.handling_fee.status !== "pending", "warn"],
    ["gift_wrap", "Gift-wrap price decided", s.gift_wrap.status !== "pending", "warn"],
    ["escrow", "Escrow auto-release period confirmed", s.escrow.status === "active", "warn"],
    ["buyer_protection", "Buyer-protection window confirmed", s.buyer_protection.status === "active", "fail"],
  ];
  for (const [id, title, ok, level] of fees)
    push({ id, group: "Rates & fees", title, status: ok ? "pass" : level, count: ok ? 0 : 1, detail: ok ? "Set." : "Still pending — a business decision is needed.", href: "/admin/rates/fees", fixLabel: "Set fees" });

  // ── Content ──
  const draftPolicies = pageRows.map((p) => ({ p, markers: policyDraftMarkers(p.body) })).filter((x) => x.markers.length);
  push({
    id: "policies",
    group: "Content",
    title: "Policy pages are final (no Draft / Pending markers)",
    status: statusFromCount(draftPolicies.length, "fail"),
    count: draftPolicies.length,
    detail: draftPolicies.length ? `${draftPolicies.length} page${draftPolicies.length === 1 ? " still reads" : "s still read"} as draft or pending.` : "All policy pages are final.",
    href: "/admin/content/pages",
    examples: draftPolicies.map(({ p, markers }) => ({ label: p.title, href: `/admin/content/pages?edit=${p.slug}`, reasons: markers })),
  });
  const copyHits = [
    ...prods.filter((p) => p.status !== "archived").map((p) => ({ label: `Listing: ${p.title}`, href: `/admin/listings/${p.id}`, reasons: scanPlaceholderCopy(p.title, p.summary, p.description, p.story) })),
    ...vens.map((v) => ({ label: `Artisan: ${v.displayName}`, href: `/admin/artisans/${v.id}`, reasons: scanPlaceholderCopy(v.displayName, v.tagline, v.story, v.craftHistory) })),
    ...journal.map((j) => ({ label: `Journal: ${j.title}`, href: `/admin/content/journal/${j.id}`, reasons: scanPlaceholderCopy(j.title, j.excerpt, j.body) })),
  ].filter((x) => x.reasons.length);
  push({
    id: "placeholder_copy",
    group: "Content",
    title: "No lorem ipsum or placeholder copy",
    status: statusFromCount(copyHits.length, "fail"),
    count: copyHits.length,
    detail: copyHits.length ? `${copyHits.length} record${copyHits.length === 1 ? " contains" : "s contain"} placeholder copy.` : "Scanned listings, artisan stories and journal posts — clean.",
    href: "/admin/listings",
    examples: copyHits,
  });

  // ── System ──
  const demoRows = demoCounts.reduce((a, r) => a + Number(r.n), 0);
  push({
    id: "demo_mode",
    group: "System",
    title: "Demo mode is off",
    status: ctx.demoMode ? "fail" : "pass",
    count: ctx.demoMode ? 1 : 0,
    detail: ctx.demoMode ? "DEMO_MODE=true — demo rows are visible with a ribbon. Set DEMO_MODE=false for launch." : "Demo mode is off.",
    href: "/admin/health",
  });
  push({
    id: "demo_rows",
    group: "System",
    title: "No demo records in the database",
    status: statusFromCount(demoRows, "warn"),
    count: demoRows,
    detail: demoRows ? demoCounts.filter((r) => Number(r.n) > 0).map((r) => `${r.n} ${r.t}`).join(", ") + " flagged as demo." : "No demo rows.",
    href: "/admin/health",
  });
  const provider = activeProvider();
  push({
    id: "payments",
    group: "System",
    title: "A live payment provider is connected",
    status: provider.mode === "live" ? "pass" : "fail",
    count: provider.mode === "live" ? 0 : 1,
    detail: provider.id === "test" ? "No Stripe key — checkout runs the test simulator (no money moves)." : provider.mode === "test" ? "Stripe is in test mode." : "Stripe live mode.",
    href: "/admin/health",
  });
  const webhookMissing = !!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_WEBHOOK_SECRET;
  push({
    id: "webhook",
    group: "System",
    title: "Payment webhook secret configured",
    status: process.env.STRIPE_SECRET_KEY ? (webhookMissing ? "fail" : "pass") : "warn",
    count: webhookMissing ? 1 : 0,
    detail: process.env.STRIPE_SECRET_KEY ? (webhookMissing ? "STRIPE_WEBHOOK_SECRET is missing — paid orders won't be confirmed." : "Configured.") : "Configure after connecting Stripe.",
    href: "/admin/health",
  });
  push({
    id: "email",
    group: "System",
    title: "Transactional email is configured",
    status: process.env.RESEND_API_KEY ? "pass" : "warn",
    count: process.env.RESEND_API_KEY ? 0 : 1,
    detail: process.env.RESEND_API_KEY ? "Emails are sent." : "RESEND_API_KEY is not set — emails are only written to the outbox.",
    href: "/admin/emails",
  });
  return items;
}
