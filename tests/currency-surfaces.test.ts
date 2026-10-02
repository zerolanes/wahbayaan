import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Brief constraint: buyer-facing pages price in USD/GBP/CAD, seller-facing pages
// in PKR, and the two are never mixed. The price components enforce the
// conversion; this test enforces which surface may use which component.

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(e.name) ? [p] : [];
  });
}

const root = path.resolve(__dirname, "..");
const sellerSurfaces = [...files(path.join(root, "src/app/seller")), ...files(path.join(root, "src/components/seller"))];
const buyerSurfaces = [
  ...files(path.join(root, "src/app/(store)")),
  ...files(path.join(root, "src/app/(home)")),
  ...files(path.join(root, "src/components/store")),
];

describe("currency surfaces", () => {
  it("seller pages never render buyer-currency prices", () => {
    const offenders = sellerSurfaces.filter((f) => /buyer-price|getBuyerContext|buyer-context/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("storefront pages never render seller (PKR) amounts directly", () => {
    const offenders = buyerSurfaces.filter((f) => /seller-price|SellerPrice/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  // Pakistani Brands: a buyer in Pakistan sees PKR because their *buyer context*
  // says so (destination PK → PKR), not because a page hard-codes rupees. Brand
  // pages therefore follow the same rule as every storefront page.
  const brandStore = [...files(path.join(root, "src/app/(store)/brands")), ...files(path.join(root, "src/components/store/brands"))];

  it("brand storefront pages exist and are covered by the storefront rule", () => {
    expect(brandStore.length).toBeGreaterThan(0);
    for (const f of brandStore) expect(buyerSurfaces).toContain(f);
  });

  it("brand storefront pages never format money in a hard-coded currency", () => {
    const offenders = brandStore.filter((f) => /formatMoney\([^)]*["'](PKR|USD|GBP|CAD)["']/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("admin brand pages show PKR or labelled order currency, never the buyer context", () => {
    const adminBrand = [
      ...files(path.join(root, "src/app/admin/brands")),
      ...files(path.join(root, "src/app/admin/brand-products")),
      ...files(path.join(root, "src/app/admin/brand-requests")),
      ...files(path.join(root, "src/components/admin/brands")),
    ];
    expect(adminBrand.length).toBeGreaterThan(0);
    const offenders = adminBrand.filter((f) => /buyer-price|getBuyerContext|buyer-context/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
