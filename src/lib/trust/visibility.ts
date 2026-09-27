/**
 * Public-visibility guards (brief, Step 1: "fix what is actively breaking trust").
 *
 * Every storefront query that lists categories, artisans or products runs its
 * rows through these checks. If something fails a check it is not shown — no
 * gray placeholder tile, no template banner, no empty 0-star rating.
 */

export type VisibilityContext = {
  /** Demo mode shows seeded demo rows (always with the sitewide demo ribbon). */
  demoMode: boolean;
};

export type Reason = { code: string; message: string };

export type CategoryLike = {
  name: string;
  coverImageUrl: string | null;
  isVisible: boolean;
  isDemo: boolean;
};

export function categoryIssues(c: CategoryLike, ctx: VisibilityContext): Reason[] {
  const issues: Reason[] = [];
  if (!c.isVisible) issues.push({ code: "hidden", message: "Hidden by an admin" });
  if (!c.coverImageUrl) issues.push({ code: "no_cover", message: "No cover image — would render as a gray placeholder tile" });
  if (c.isDemo && !ctx.demoMode) issues.push({ code: "demo", message: "Demo content" });
  return issues;
}

export function isCategoryPublic(c: CategoryLike, ctx: VisibilityContext) {
  return categoryIssues(c, ctx).length === 0;
}

export type VendorLike = {
  id: string;
  displayName: string;
  status: string;
  profilePhotoUrl: string | null;
  bannerUrl: string | null;
  story: string | null;
  workshopCity: string | null;
  isDemo: boolean;
};

/** Placeholder copy that must never reach a public profile. */
const PLACEHOLDER_PATTERNS = [/lorem ipsum/i, /wah\s*bayaan marketplace/i, /^\s*(test|demo|sample)\b/i, /coming soon/i];

export function looksLikePlaceholderText(text: string | null | undefined) {
  if (!text) return false;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(text));
}

/**
 * `sharedBanners` is the set of banner URLs used by more than one artisan.
 * A shared banner means the store is still on a template.
 */
export function vendorIssues(v: VendorLike, ctx: VisibilityContext, sharedBanners: ReadonlySet<string>): Reason[] {
  const issues: Reason[] = [];
  if (v.status !== "verified") issues.push({ code: "not_verified", message: "Artisan is not verified" });
  if (!v.profilePhotoUrl) issues.push({ code: "no_photo", message: "No profile photo" });
  if (!v.story || v.story.trim().length < 80) issues.push({ code: "no_story", message: "Story missing or under 80 characters" });
  if (!v.workshopCity) issues.push({ code: "no_location", message: "Workshop location missing" });
  if (v.bannerUrl && sharedBanners.has(v.bannerUrl))
    issues.push({ code: "shared_banner", message: "Banner image is shared with another artisan" });
  if (looksLikePlaceholderText(v.displayName) || looksLikePlaceholderText(v.story))
    issues.push({ code: "placeholder_copy", message: "Name or story contains placeholder copy" });
  if (v.isDemo && !ctx.demoMode) issues.push({ code: "demo", message: "Demo content" });
  return issues;
}

export function isVendorPublic(v: VendorLike, ctx: VisibilityContext, sharedBanners: ReadonlySet<string>) {
  return vendorIssues(v, ctx, sharedBanners).length === 0;
}

export function findSharedBanners(vendors: ReadonlyArray<{ bannerUrl: string | null }>): Set<string> {
  const seen = new Map<string, number>();
  for (const v of vendors) if (v.bannerUrl) seen.set(v.bannerUrl, (seen.get(v.bannerUrl) ?? 0) + 1);
  return new Set([...seen].filter(([, n]) => n > 1).map(([url]) => url));
}

export type ProductLike = {
  title: string;
  status: string;
  imageCount: number;
  weightG: number | null;
  isDemo: boolean;
  description: string | null;
};

export function productIssues(p: ProductLike, ctx: VisibilityContext): Reason[] {
  const issues: Reason[] = [];
  if (p.status !== "active") issues.push({ code: "not_active", message: `Status is ${p.status}` });
  if (p.imageCount === 0) issues.push({ code: "no_images", message: "No images" });
  if (looksLikePlaceholderText(p.title) || looksLikePlaceholderText(p.description))
    issues.push({ code: "placeholder_copy", message: "Title or description contains placeholder copy" });
  if (p.isDemo && !ctx.demoMode) issues.push({ code: "demo", message: "Demo content" });
  return issues;
}

export function isProductPublic(p: ProductLike, ctx: VisibilityContext) {
  return productIssues(p, ctx).length === 0;
}
