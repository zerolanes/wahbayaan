/**
 * Brand permission gate and buyer-facing relationship wording. Pure.
 *
 * Legal / brand safety: copying a brand's catalogue and photos without
 * permission is a trademark, copyright and terms-of-service risk, and the site
 * must never imply a partnership that doesn't exist.
 *
 * - Nothing is imported automatically (sync button, cron, feed upload) until an
 *   admin has recorded that permission is in place: who, when and a note. The
 *   recording is audited.
 * - A brand's catalogue, logo and photos are shown publicly only when the brand
 *   is an authorised partner — which itself requires the recorded permission.
 *   Staff can prepare a brand (draft) before that; it goes live once authorised.
 * - Brands without permission are reachable only through the wording-neutral
 *   "shop by link" personal-shopper flow.
 */
export type Partnership = "none" | "requested" | "authorised";
export type SourceType = "shopify_json" | "csv_feed" | "manual";
export type SyncTrigger = "admin" | "cron" | "upload";

export type BrandPermissionState = {
  permissionGrantedAt: Date | null;
  permissionGrantedById: string | null;
  permissionNote: string | null;
};

export function hasRecordedPermission(b: BrandPermissionState): boolean {
  return !!b.permissionGrantedAt && !!b.permissionGrantedById && !!b.permissionNote?.trim();
}

export type GateResult = { ok: true } | { ok: false; reason: string };

/** May the automatic-sync toggle be switched on? */
export function canEnableSync(b: BrandPermissionState & { sourceType: SourceType }): GateResult {
  if (!hasRecordedPermission(b))
    return { ok: false, reason: "Record the brand's permission first (who granted it, when, and a note). Sync stays off until then." };
  if (b.sourceType === "manual") return { ok: false, reason: "This brand's products are entered by hand — there is no feed to sync. Choose a source type first." };
  return { ok: true };
}

/** May an import run now? Checked by the sync engine itself, so no caller can skip it. */
export function syncGate(b: BrandPermissionState & { sourceType: SourceType; syncEnabled: boolean; sourceUrl?: string | null }, trigger: SyncTrigger): GateResult {
  if (!hasRecordedPermission(b)) return { ok: false, reason: "No permission is recorded for this brand — import refused." };
  if (trigger === "upload") return b.sourceType === "csv_feed" ? { ok: true } : { ok: false, reason: "Feed uploads are only accepted when the source type is “CSV / feed upload”." };
  if (b.sourceType === "manual") return { ok: false, reason: "Manual-entry brands have nothing to sync." };
  if (!b.syncEnabled) return { ok: false, reason: "Sync is switched off for this brand." };
  if (b.sourceType === "shopify_json" && !b.sourceUrl) return { ok: false, reason: "No products.json URL is configured." };
  if (b.sourceType === "csv_feed") return { ok: false, reason: "CSV feeds are imported by uploading the file, not fetched." };
  return { ok: true };
}

/** Partnership can only be set to `authorised` once the permission is recorded. */
export function canAuthorise(b: BrandPermissionState): GateResult {
  return hasRecordedPermission(b) ? { ok: true } : { ok: false, reason: "Record the brand's permission (who, when, note) before marking the partnership as authorised." };
}

/** Public display of the brand's catalogue, logo and photos. */
export function catalogueDisplayGate(b: BrandPermissionState & { partnership: Partnership }): GateResult {
  if (b.partnership !== "authorised") return { ok: false, reason: "Not an authorised partner — the catalogue stays private (shop-by-link only)." };
  if (!hasRecordedPermission(b)) return { ok: false, reason: "Partnership is marked authorised but no permission is recorded." };
  return { ok: true };
}

export const PARTNERSHIP_LABEL: Record<Partnership, string> = {
  none: "No partnership",
  requested: "Partnership requested",
  authorised: "Authorised partner",
};

/** The line shown on public brand pages (only authorised brands have them). */
export function partnerLine(brandName: string) {
  return `${brandName}'s collection on Wahbayaan — ordered from ${brandName} for you and delivered to your door.`;
}

/** Wording for the shop-by-link flow: neutral, no claims about any brand. */
export const SHOP_BY_LINK_LINE = "We'll buy it for you and deliver.";

/** Fallback tile text when an authorised brand hasn't supplied its logo yet. */
export function monogram(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}
