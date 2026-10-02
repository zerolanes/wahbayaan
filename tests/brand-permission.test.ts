import { describe, expect, it } from "vitest";
import { canEnableSync, hasRecordedPermission, relationshipDisclosure, syncGate } from "@/lib/brands/permission";

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

describe("relationship wording", () => {
  it("never says official unless the partnership is authorised", () => {
    for (const p of ["none", "requested"] as const) {
      const d = relationshipDisclosure("Noor Lawn House", p);
      expect(d.official).toBe(false);
      expect(`${d.badge} ${d.short}`).not.toMatch(/official/i);
      expect(d.short).toMatch(/personal-shopping service/);
      expect(d.long).toMatch(/not affiliated/);
    }
    const a = relationshipDisclosure("Noor Lawn House", "authorised");
    expect(a.official).toBe(true);
    expect(a.badge).toBe("Official partner");
  });
});
