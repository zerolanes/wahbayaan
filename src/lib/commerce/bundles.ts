/**
 * Bundle savings: a published bundle with `bundleDiscountBps` takes that share
 * off its pieces when every piece of the bundle is in the cart. Pure, so the
 * cart, the collection page and tests agree on the arithmetic.
 */
import { applyBps } from "@/lib/money/currency";

export type BundleRule = { slug: string; title: string; bundleDiscountBps: number | null; productIds: string[] };
export type BundleLine = { productId: string; unitPrice: number; qty: number };

export type BundleSaving = { amount: number; label: string; bundles: { slug: string; title: string; amount: number }[] };

/** Saving on one bundle's combined price (one of each piece). */
export function bundleSavingFor(pieceUnitPrices: number[], bps: number | null | undefined) {
  if (!bps || bps <= 0) return 0;
  return applyBps(pieceUnitPrices.reduce((a, b) => a + b, 0), bps);
}

export function computeBundleSavings(bundles: BundleRule[], lines: BundleLine[]): BundleSaving | null {
  // Units still available to count toward a bundle, per product.
  const units = new Map<string, number>();
  const price = new Map<string, number>();
  for (const l of lines) {
    units.set(l.productId, (units.get(l.productId) ?? 0) + l.qty);
    price.set(l.productId, l.unitPrice);
  }
  const candidates = bundles
    .filter((b) => b.bundleDiscountBps && b.bundleDiscountBps > 0 && b.productIds.length > 1)
    .map((b) => ({ b, value: bundleSavingFor(b.productIds.map((id) => price.get(id) ?? 0), b.bundleDiscountBps) }))
    .sort((x, y) => y.value - x.value);

  const applied: BundleSaving["bundles"] = [];
  for (const { b } of candidates) {
    if (!b.productIds.every((id) => (units.get(id) ?? 0) > 0)) continue;
    for (const id of b.productIds) units.set(id, (units.get(id) ?? 0) - 1);
    applied.push({ slug: b.slug, title: b.title, amount: bundleSavingFor(b.productIds.map((id) => price.get(id)!), b.bundleDiscountBps) });
  }
  if (!applied.length) return null;
  const amount = applied.reduce((a, x) => a + x.amount, 0);
  if (amount <= 0) return null;
  return {
    amount,
    label: applied.length === 1 ? `Bundle saving — ${applied[0].title}` : `Bundle savings (${applied.length})`,
    bundles: applied,
  };
}
