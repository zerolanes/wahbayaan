import { describe, expect, it } from "vitest";
import {
  findSharedBanners,
  isCategoryPublic,
  isVendorPublic,
  vendorIssues,
  type VendorLike,
} from "@/lib/trust/visibility";

const prod = { demoMode: false };
const story =
  "Third-generation calligrapher working in the old city, trained by his grandfather in Nastaliq and Thuluth.";

const artisan = (over: Partial<VendorLike> = {}): VendorLike => ({
  id: "v1",
  displayName: "Ustad Kareem",
  status: "verified",
  profilePhotoUrl: "/media/kareem.jpg",
  bannerUrl: "/media/kareem-banner.jpg",
  story,
  workshopCity: "Lahore",
  isDemo: false,
  ...over,
});

describe("category visibility", () => {
  it("hides categories without a cover image instead of showing a gray tile", () => {
    expect(isCategoryPublic({ name: "Posters & Prints", coverImageUrl: null, isVisible: true, isDemo: false }, prod)).toBe(false);
    expect(isCategoryPublic({ name: "Rugs", coverImageUrl: "/media/rugs.jpg", isVisible: true, isDemo: false }, prod)).toBe(true);
  });

  it("hides demo categories outside demo mode", () => {
    const demo = { name: "Rugs", coverImageUrl: "/x.jpg", isVisible: true, isDemo: true };
    expect(isCategoryPublic(demo, prod)).toBe(false);
    expect(isCategoryPublic(demo, { demoMode: true })).toBe(true);
  });
});

describe("artisan visibility", () => {
  it("shows a verified artisan with a real profile", () => {
    expect(isVendorPublic(artisan(), prod, new Set())).toBe(true);
  });

  it("hides unverified, photo-less or story-less artisans", () => {
    expect(isVendorPublic(artisan({ status: "in_review" }), prod, new Set())).toBe(false);
    expect(isVendorPublic(artisan({ profilePhotoUrl: null }), prod, new Set())).toBe(false);
    expect(isVendorPublic(artisan({ story: "Hello" }), prod, new Set())).toBe(false);
  });

  it("hides every artisan sharing the template banner", () => {
    const vendors = [
      artisan({ id: "a", bannerUrl: "/banner-default.jpg" }),
      artisan({ id: "b", bannerUrl: "/banner-default.jpg" }),
      artisan({ id: "c", bannerUrl: "/own.jpg" }),
    ];
    const shared = findSharedBanners(vendors);
    expect(vendors.map((v) => isVendorPublic(v, prod, shared))).toEqual([false, false, true]);
  });

  it("flags placeholder copy like the old 'WAH BAYAAN MARKETPLACE' banner text", () => {
    const codes = vendorIssues(artisan({ story: `WAH BAYAAN MARKETPLACE ${story}` }), prod, new Set()).map((i) => i.code);
    expect(codes).toContain("placeholder_copy");
  });

  it("hides demo artisans in production", () => {
    expect(isVendorPublic(artisan({ isDemo: true }), prod, new Set())).toBe(false);
    expect(isVendorPublic(artisan({ isDemo: true }), { demoMode: true }, new Set())).toBe(true);
  });
});
