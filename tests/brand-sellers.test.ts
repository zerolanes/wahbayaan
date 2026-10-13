import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { brandCsvTemplate, planBrandImport, validateBrandCsv, type ExistingProduct, type ExistingVariant } from "@/lib/brand-portal/csv";
import { acceptanceGate, BRAND_SELLER_TERMS_VERSION, permissionFromAcceptance, type TermsAcceptance } from "@/lib/brand-portal/terms";
import { catalogueDisplayGate } from "@/lib/brands/permission";
import { brandIssues } from "@/lib/trust/visibility";
import { excludeListedBrands, looksLikeContactDetail, parseDirectorySeed, shopWithWahbayaanHref, toPublicEntry } from "@/lib/directory";
import { affiliateDisplayGate, buildTrackingLink, isAffiliateProductDisplayable, parseAffiliateFeed, validateTrackingTemplate } from "@/lib/affiliate";
import { activeSocialLinks, normalizeSocialUrl, parseSocialLinks } from "@/lib/social";
import { SocialLinksList } from "@/components/store/social-links";

const HEADER = "handle,title,description,audience,category,collection,fabric,tags,image_urls,size,colour,sku,price_pkr,compare_at_price_pkr,stock,weight_g,status";

// ── CSV validation ──────────────────────────────────────────────────────────

describe("brand portal CSV validation", () => {
  it("accepts the downloadable template", () => {
    const v = validateBrandCsv(brandCsvTemplate());
    expect(v.fatal).toBeNull();
    expect(v.errors).toEqual([]);
    expect(v.products.map((p) => p.handle)).toEqual(["rang-lawn-3pc", "sahar-kurta"]);
    const rang = v.products[0];
    expect(rang.variants.map((x) => x.sku)).toEqual(["RANG-TEAL-S", "RANG-TEAL-M", "RANG-TEAL-L"]);
    expect(rang.variants[0]).toMatchObject({ pricePkr: 649000, compareAtPricePkr: 799000, stockQty: 12, size: "S", colour: "Teal" });
    expect(rang.imageUrls).toHaveLength(2);
    expect(rang.status).toBe("draft");
  });

  it("reports row-level errors with the spreadsheet row and column, and skips only the broken product", () => {
    const csv = [
      HEADER,
      "good,Good Kurta,,men,,,,,https://img.example/a.jpg,M,Blue,G-M,4000,,3,,",
      "bad,Bad Suit,,women,,,,,ftp://nope,S,Red,B-S,abc,,-2,,",
      "bad,,,,,,,,,M,Red,G-M,3000,,1,,",
      ",,,,,,,,,L,Red,,3000,,1,,",
      "odd,Odd Top,,aliens,,,,,,S,,O-S,1000,,,,live",
    ].join("\n");
    const v = validateBrandCsv(csv);
    expect(v.fatal).toBeNull();
    expect(v.products.map((p) => p.handle)).toEqual(["good"]);
    expect(v.skipped.map((s) => s.handle).sort()).toEqual(["bad", "odd"]);
    const at = (line: number, column: string) => v.errors.find((e) => e.line === line && e.column === column);
    expect(at(3, "image_urls")?.message).toMatch(/https/);
    expect(at(3, "price_pkr")?.message).toMatch(/not a positive amount/);
    expect(at(3, "stock")?.message).toMatch(/whole number/);
    expect(at(4, "sku")?.message).toMatch(/already used on row 2/);
    expect(at(5, "title")).toBeTruthy(); // no handle and no title
    expect(at(6, "audience")?.message).toMatch(/women, men, kids, unisex/);
    expect(at(6, "status")).toBeTruthy();
  });

  it("refuses a file without the required columns", () => {
    expect(validateBrandCsv("title,price\nA,100").fatal).toMatch(/sku, price_pkr/);
    expect(validateBrandCsv(HEADER).fatal).toMatch(/at least one product row/);
    expect(validateBrandCsv(`${HEADER}\n"unclosed,`).fatal).toMatch(/unclosed quote/);
  });

  it("flags conflicting product values and duplicate size/colour within a product", () => {
    const csv = [HEADER, "p1,Title A,,,,,,,,S,Red,P1-S,100,,,,", "p1,Title B,,,,,,,,S,Red,P1-S2,100,,,,"].join("\n");
    const v = validateBrandCsv(csv);
    expect(v.errors.some((e) => e.line === 3 && e.column === "title" && /Differs from row 2/.test(e.message))).toBe(true);
    expect(v.errors.some((e) => e.line === 3 && e.column === "size" && /Same size and colour/.test(e.message))).toBe(true);
  });

  it("points at the real file line when a quoted field spans lines", () => {
    const csv = `${HEADER}\np1,T,"line one\nline two",,,,,,,S,,P1-S,100,,,,\np2,,,,,,,,,S,,,100,,,,`;
    const v = validateBrandCsv(csv);
    expect(v.errors.find((e) => e.column === "sku")?.line).toBe(4);
  });
});

// ── Import plan (idempotent by SKU) ─────────────────────────────────────────

describe("brand portal import plan", () => {
  const v = validateBrandCsv(brandCsvTemplate());

  it("creates everything on first upload", () => {
    const plan = planBrandImport(v, { products: [], variants: [] });
    expect(plan.counts).toMatchObject({ productsCreate: 2, variantsCreate: 4, productsUpdate: 0, variantsUpdate: 0 });
  });

  it("keeps a photo-less 'published' row as a draft (buyers only see products with a photo)", () => {
    const csv = [HEADER, "p1,Plain Kurta,,men,,,,,,M,,PK-M,3000,,2,,published", "p2,Lawn Suit,,women,,,,,https://img.example/1.jpg,S,,LS-S,5000,,2,,published"].join("\n");
    const plan = planBrandImport(validateBrandCsv(csv), { products: [], variants: [] });
    expect(plan.products.map((p) => p.patch.status)).toEqual(["draft", "published"]);
    expect(plan.products[0].notes[0]).toMatch(/No photo/);
  });

  it("is idempotent: the same file against the imported state changes nothing", () => {
    const products: ExistingProduct[] = v.products.map((p, i) => ({
      id: `p${i}`,
      externalId: p.handle,
      title: p.title,
      description: p.description,
      audience: p.audience,
      category: p.category,
      collection: p.collection,
      fabric: p.fabric,
      tags: p.tags,
      weightG: p.weightG,
      status: p.status ?? "draft",
      imageUrls: p.imageUrls,
    }));
    const variants: ExistingVariant[] = v.products.flatMap((p, i) =>
      p.variants.map((x, j) => ({ id: `v${i}-${j}`, productId: `p${i}`, sku: x.sku.toLowerCase(), size: x.size, colour: x.colour, pricePkr: x.pricePkr, compareAtPricePkr: x.compareAtPricePkr, stockQty: x.stockQty, available: x.stockQty !== 0 })),
    );
    // SKU matching is case-insensitive.
    variants.forEach((x) => (x.sku = x.sku!.toUpperCase()));
    const plan = planBrandImport(v, { products, variants });
    expect(plan.counts).toMatchObject({ productsCreate: 0, productsUpdate: 0, productsUnchanged: 2, variantsCreate: 0, variantsUpdate: 0, variantsUnchanged: 4 });

    // Change one price → exactly one variant update; a product made in the portal (no handle) is matched by SKU.
    const edited = validateBrandCsv(brandCsvTemplate().replace("RANG-TEAL-M,6490", "RANG-TEAL-M,5990"));
    const noHandle = products.map((p) => (p.id === "p1" ? { ...p, externalId: null } : p));
    const plan2 = planBrandImport(edited, { products: noHandle, variants });
    expect(plan2.counts).toMatchObject({ productsCreate: 0, variantsCreate: 0, variantsUpdate: 1 });
    expect(plan2.products.find((p) => p.csv.handle === "sahar-kurta")?.productId).toBe("p1");
    expect(plan2.products[0].variants.find((x) => x.csv.sku === "RANG-TEAL-M")?.changes).toEqual(["pricePkr"]);
  });
});

// ── Terms acceptance → authorised ───────────────────────────────────────────

describe("brand seller terms acceptance", () => {
  const ok: TermsAcceptance = { userId: "00000000-0000-4000-8000-000000000001", name: "Ayesha Khan", email: "ayesha@label.example", termsVersion: BRAND_SELLER_TERMS_VERSION, acceptedAt: new Date("2026-10-01T10:00:00Z") };

  it("a complete, current acceptance makes the brand authorised with a recorded permission", () => {
    const r = permissionFromAcceptance(ok, { evidenceUrl: "/admin/applications/brand/x" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.patch.partnership).toBe("authorised");
    expect(r.patch.permissionGrantedById).toBe(ok.userId);
    expect(r.patch.permissionGrantedAt).toEqual(ok.acceptedAt);
    expect(r.patch.permissionNote).toContain(BRAND_SELLER_TERMS_VERSION);
    expect(r.patch.permissionNote).toContain("ayesha@label.example");
    expect(catalogueDisplayGate(r.patch).ok).toBe(true);
    const issues = brandIssues({ name: "Ayesha Label", isActive: true, isDemo: false, description: null, ...r.patch }, { demoMode: false });
    expect(issues).toEqual([]);
  });

  it("no acceptance, an unlinked account, a stale version or a future date never authorises", () => {
    expect(permissionFromAcceptance(null).ok).toBe(false);
    expect(permissionFromAcceptance({ ...ok, userId: null }).ok).toBe(false);
    expect(permissionFromAcceptance({ ...ok, termsVersion: "2025-01-old" }).ok).toBe(false);
    expect(permissionFromAcceptance({ ...ok, acceptedAt: null }).ok).toBe(false);
    expect(permissionFromAcceptance({ ...ok, email: "not-an-email" }).ok).toBe(false);
    expect(acceptanceGate({ ...ok, acceptedAt: new Date(Date.now() + 86_400_000) }).ok).toBe(false);
  });

  it("without the acceptance the brand stays private (shop-by-link only)", () => {
    const issues = brandIssues(
      { name: "Ayesha Label", isActive: true, isDemo: false, description: null, partnership: "none", permissionGrantedAt: null, permissionGrantedById: null, permissionNote: null },
      { demoMode: false },
    );
    expect(issues.map((i) => i.code)).toContain("not_authorised");
  });
});

// ── Directory: never exposes emails/phones ──────────────────────────────────

describe("brand directory", () => {
  const csvPath = path.join(__dirname, "..", "docs", "outreach", "pakistani-brands.csv");
  const raw = fs.existsSync(csvPath) ? fs.readFileSync(csvPath, "utf8") : `brand,category,website,email,phone,notes\nKhaadi,both,https://www.khaadi.com,welisten@khaadi.com,0800-74007,"HQ Clifton, call +92 21 111 000 000"`;

  it("reads only name, category and website from the outreach file", () => {
    const entries = parseDirectorySeed(raw);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) expect(Object.keys(e).sort()).toEqual(["category", "description", "name", "slug", "websiteUrl"]);
    const blob = JSON.stringify(entries.map(toPublicEntry));
    expect(blob).not.toMatch(/[^\s@"]+@[^\s@"]+\.[a-z]{2,}/i); // no email addresses
    expect(blob).not.toMatch(/\+?\d[\d\s().-]{7,}\d/); // no phone numbers
    expect(blob).not.toMatch(/customer care|HQ |instagram|@/i);
    const khaadi = entries.find((e) => e.slug === "khaadi")!;
    expect(khaadi).toMatchObject({ name: "Khaadi", category: "women_men", websiteUrl: "https://www.khaadi.com/" });
  });

  it("whitelists public fields even if a row carries extra data", () => {
    const pub = toPublicEntry({ slug: "x", name: "X Label", category: "both", description: null, websiteUrl: "https://x.example", ...{ email: "a@b.com", phone: "+92 300 1234567" } } as never);
    expect(Object.keys(pub).sort()).toEqual(["category", "categoryLabel", "description", "name", "shopHref", "slug", "websiteUrl"]);
    expect(JSON.stringify(pub)).not.toContain("a@b.com");
    expect(pub.shopHref).toBe("/brands/request?brand=X%20Label");
  });

  it("detects contact details typed into a description, and hides brands already on Wahbayaan", () => {
    expect(looksLikeContactDetail("Call 0300 1234567")).toBe(true);
    expect(looksLikeContactDetail("hello@brand.pk")).toBe(true);
    expect(looksLikeContactDetail("Pakistani womenswear brand.")).toBe(false);
    expect(excludeListedBrands([{ slug: "khaadi", name: "Khaadi" }, { slug: "zeen", name: "Zeen" }], [{ slug: "khaadi-official", name: "Khaadi" }])).toEqual([{ slug: "zeen", name: "Zeen" }]);
    expect(shopWithWahbayaanHref("Sana Safinaz")).toBe("/brands/request?brand=Sana%20Safinaz");
  });
});

// ── Affiliate display gate ──────────────────────────────────────────────────

describe("affiliate display gate", () => {
  const base = {
    status: "active",
    trackingTemplate: "https://track.example/click?a=1&u={url}",
    displayAllowed: true,
    displayAllowedAt: new Date("2026-10-01"),
    displayAllowedById: "00000000-0000-4000-8000-000000000002",
    displayAllowedNote: "Programme terms §4 allow product and image display.",
  };
  const product = { title: "Lawn suit", productUrl: "https://store.example/p/1", imageUrl: "https://cdn.store.example/1.jpg", isHidden: false };

  it("shows feed products only with a recorded terms permission on an active programme", () => {
    expect(affiliateDisplayGate(base).ok).toBe(true);
    expect(isAffiliateProductDisplayable(base, product)).toBe(true);
    expect(affiliateDisplayGate({ ...base, displayAllowed: false }).ok).toBe(false);
    expect(affiliateDisplayGate({ ...base, displayAllowedNote: "  " }).ok).toBe(false);
    expect(affiliateDisplayGate({ ...base, displayAllowedById: null }).ok).toBe(false);
    expect(affiliateDisplayGate({ ...base, status: "paused" }).ok).toBe(false);
    expect(affiliateDisplayGate({ ...base, trackingTemplate: "https://track.example/click" }).ok).toBe(false);
    expect(isAffiliateProductDisplayable(base, { ...product, isHidden: true })).toBe(false);
    expect(isAffiliateProductDisplayable(base, { ...product, imageUrl: null })).toBe(false);
  });

  it("builds the outbound tracking link with the encoded product URL", () => {
    expect(buildTrackingLink(base.trackingTemplate, product.productUrl)).toBe("https://track.example/click?a=1&u=https%3A%2F%2Fstore.example%2Fp%2F1");
    expect(buildTrackingLink("http://track.example/?u={url}", product.productUrl)).toBeNull();
    expect(validateTrackingTemplate("https://t.example/{url}/{url}").ok).toBe(false);
  });

  it("parses a CSV feed with row errors", () => {
    const r = parseAffiliateFeed("id,name,link,image_link,price\n1,Suit,https://s.example/1,https://s.example/1.jpg,3490\n2,,https://s.example/2,,\n3,Bag,http://s.example/3,,\n1,Dup,https://s.example/4,,");
    expect(r.products).toEqual([{ externalId: "1", title: "Suit", productUrl: "https://s.example/1", imageUrl: "https://s.example/1.jpg", pricePkr: 349000, category: null }]);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4, 5]);
  });
});

// ── Social links ────────────────────────────────────────────────────────────

describe("social links", () => {
  it("normalises links and rejects the wrong network", () => {
    expect(normalizeSocialUrl("instagram", "instagram.com/wahbayaan")).toEqual({ ok: true, url: "https://instagram.com/wahbayaan" });
    expect(normalizeSocialUrl("whatsapp", "+92 300 1234567")).toEqual({ ok: true, url: "https://wa.me/923001234567" });
    expect(normalizeSocialUrl("x", "https://twitter.com/wahbayaan").ok).toBe(true);
    expect(normalizeSocialUrl("facebook", "https://evil.example/fb").ok).toBe(false);
    expect(parseSocialLinks({ instagram: "", tiktok: "https://www.tiktok.com/@wahbayaan" })).toEqual({ ok: true, links: { tiktok: "https://www.tiktok.com/@wahbayaan" } });
  });

  it("renders only the icons that have a URL", () => {
    expect(renderToStaticMarkup(createElement(SocialLinksList, { links: {}, owner: "Wahbayaan" }))).toBe("");
    expect(renderToStaticMarkup(createElement(SocialLinksList, { links: { instagram: "  " }, owner: "Wahbayaan" }))).toBe("");
    const html = renderToStaticMarkup(createElement(SocialLinksList, { links: { instagram: "https://instagram.com/w", youtube: "https://youtube.com/@w" }, owner: "Wahbayaan" }));
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain('aria-label="Wahbayaan on Instagram (opens in a new tab)"');
    expect(html).toContain('aria-label="Wahbayaan on YouTube (opens in a new tab)"');
    expect(html).not.toContain("Facebook");
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toMatch(/<script|<iframe/);
    expect(activeSocialLinks({ x: "https://x.com/w", linkedin: "javascript:alert(1)" }).map((s) => s.key)).toEqual(["x"]);
  });
});
