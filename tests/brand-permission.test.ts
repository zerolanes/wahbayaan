import { describe, expect, it } from "vitest";
import { canAuthorise, canEnableSync, catalogueDisplayGate, hasRecordedPermission, monogram, partnerLine, SHOP_BY_LINK_LINE, syncGate } from "@/lib/brands/permission";
import { isBrandPublic } from "@/lib/trust/visibility";

const none = { permissionGrantedAt: null, permissionGrantedById: null, permissionNote: null };
const granted = { permissionGrantedAt: new Date("2026-09-01"), permissionGrantedById: "00000000-0000-0000-0000-000000000001", permissionNote: "Email from brand's e-commerce lead, 1 Sep 2026" };

describe("brand permission gate", () => {
  it("needs who, when and a note", () => {
    expect(hasRecordedPermission(none)).toBe(false);
    expect(hasRecordedPermission({ ...granted, permissionNote: "  " })).toBe(false);
    expect(hasRecordedPermission({ ...granted, permissionGrantedById: null })).toBe(false);
    expect(hasRecordedPermission(granted)).toBe(true);
  });

  it("won't let sync be switched on before permission is recorded", () => {
    const r = canEnableSync({ ...none, sourceType: "shopify_json" });
    expect(r.ok).toBe(false);
    expect(canEnableSync({ ...granted, sourceType: "shopify_json" }).ok).toBe(true);
    expect(canEnableSync({ ...granted, sourceType: "manual" }).ok).toBe(false);
  });

  it("refuses every import trigger without permission, even if sync was somehow switched on", () => {
    for (const trigger of ["admin", "cron", "upload"] as const) {
      const r = syncGate({ ...none, sourceType: trigger === "upload" ? "csv_feed" : "shopify_json", syncEnabled: true, sourceUrl: "https://x.example/products.json" }, trigger);
      expect(r).toEqual({ ok: false, reason: "No permission is recorded for this brand — import refused." });
    }
  });

  it("allows a configured, permitted, enabled source", () => {
    expect(syncGate({ ...granted, sourceType: "shopify_json", syncEnabled: true, sourceUrl: "https://x.example/products.json" }, "cron")).toEqual({ ok: true });
    expect(syncGate({ ...granted, sourceType: "shopify_json", syncEnabled: false, sourceUrl: "https://x.example/products.json" }, "admin").ok).toBe(false);
    expect(syncGate({ ...granted, sourceType: "shopify_json", syncEnabled: true, sourceUrl: null }, "admin").ok).toBe(false);
    expect(syncGate({ ...granted, sourceType: "csv_feed", syncEnabled: false }, "upload")).toEqual({ ok: true });
  });
});

describe("public catalogue display", () => {
  const brand = { name: "Noor Lawn House", isActive: true, isDemo: false, description: null };
  const ctx = { demoMode: false };

  it("is limited to authorised partners with a recorded permission", () => {
    expect(isBrandPublic({ ...brand, ...none, partnership: "none" }, ctx)).toBe(false);
    expect(isBrandPublic({ ...brand, ...granted, partnership: "requested" }, ctx)).toBe(false);
    // Marked authorised without a permission record: still private.
    expect(isBrandPublic({ ...brand, ...none, partnership: "authorised" }, ctx)).toBe(false);
    expect(catalogueDisplayGate({ ...none, partnership: "authorised" }).ok).toBe(false);
    expect(isBrandPublic({ ...brand, ...granted, partnership: "authorised" }, ctx)).toBe(true);
    // A prepared (draft) brand stays off until switched on.
    expect(isBrandPublic({ ...brand, ...granted, partnership: "authorised", isActive: false }, ctx)).toBe(false);
  });

  it("can only be authorised once permission is recorded", () => {
    expect(canAuthorise(none).ok).toBe(false);
    expect(canAuthorise(granted).ok).toBe(true);
    expect(hasRecordedPermission(granted)).toBe(true);
  });

  it("uses partner wording on brand pages and neutral wording for shop-by-link", () => {
    expect(partnerLine("Noor Lawn House")).toMatch(/Noor Lawn House's collection on Wahbayaan/);
    expect(SHOP_BY_LINK_LINE).toBe("We'll buy it for you and deliver.");
    expect(SHOP_BY_LINK_LINE).not.toMatch(/affiliat|official|reseller/i);
    expect(monogram("Noor Lawn House")).toBe("NL");
  });
});
