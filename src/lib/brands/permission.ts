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
 * - "Official" wording is only ever used when the partnership is `authorised`.
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

export const PARTNERSHIP_LABEL: Record<Partnership, string> = {
  none: "No partnership",
  requested: "Partnership requested",
  authorised: "Authorised partner",
};

/**
 * What the storefront says about who is selling. Shown on every brand page,
 * product page and in the bag.
 */
export function relationshipDisclosure(brandName: string, partnership: Partnership): { badge: string; short: string; long: string; official: boolean } {
  if (partnership === "authorised")
    return {
      badge: "Official partner",
      official: true,
      short: `Sold by Wahbayaan as an authorised partner of ${brandName}.`,
      long: `Wahbayaan is an authorised partner of ${brandName}. We buy each order from ${brandName} and deliver it to you.`,
    };
  return {
    badge: "Personal-shopping service",
    official: false,
    short: `Sold by Wahbayaan as a personal-shopping service. Not affiliated with or endorsed by ${brandName}.`,
    long: `Wahbayaan is a personal-shopping service: we buy this item from ${brandName} on your behalf and deliver it to you. ${brandName} is a trademark of its owner; Wahbayaan is not affiliated with or endorsed by ${brandName}, and this is not ${brandName}'s official store.`,
  };
}
