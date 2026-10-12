/**
 * Brand seller terms and the "terms acceptance → authorised" rule. Pure.
 *
 * A self-signup brand uploads its own logo, photos and products and accepts
 * these terms when it applies. That acceptance (who, when, which version) is the
 * brand's permission record: on approval the brand becomes `authorised` with the
 * acceptance as its permission — no separate manual permission is needed. A
 * missing, stale or incomplete acceptance never authorises anything.
 */
import { catalogueDisplayGate, type GateResult } from "@/lib/brands/permission";

/** Bump when the terms below change; brands accept the version current at signup. */
export const BRAND_SELLER_TERMS_VERSION = "2026-10-brand-v1";

export const BRAND_SELLER_TERMS: { title: string; text: string }[] = [
  { title: "Your content", text: "You own, or have the right to use, every logo, photo and description you upload. You allow Wahbayaan to display them on wahbayaan.com and in its marketing of your products." },
  { title: "Your catalogue", text: "Prices are in PKR and include your item price only. Wahbayaan's service fee, delivery and any import costs are added as separate lines for the buyer." },
  { title: "Stock and accuracy", text: "Keep stock, sizes and prices current. Mark items unavailable as soon as they sell out elsewhere." },
  { title: "Orders", text: "When a buyer pays, you prepare the ordered items and mark them ready for Wahbayaan to collect. Wahbayaan handles payment, delivery and customer service." },
  { title: "Payment to you", text: "You are paid your listed price for items Wahbayaan collects, on the schedule agreed at approval." },
  { title: "Listing on Wahbayaan", text: "Wahbayaan may decline or remove a listing that breaks these terms or the law. You may close your brand page at any time." },
];

export type TermsAcceptance = {
  /** The account that accepted (linked at approval when the applicant applied signed out). */
  userId: string | null;
  name: string;
  email: string;
  termsVersion: string;
  acceptedAt: Date | null;
};

/** Is this acceptance good enough to stand as the brand's permission record? */
export function acceptanceGate(a: TermsAcceptance | null | undefined, now = new Date()): GateResult {
  if (!a) return { ok: false, reason: "No acceptance of the brand seller terms is recorded." };
  if (!a.userId) return { ok: false, reason: "The acceptance isn't linked to the brand's account yet." };
  if (!a.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email.trim())) return { ok: false, reason: "The acceptance is missing the name or email of the person who accepted." };
  if (!a.acceptedAt || Number.isNaN(a.acceptedAt.getTime())) return { ok: false, reason: "The acceptance has no date." };
  if (a.acceptedAt.getTime() > now.getTime() + 60_000) return { ok: false, reason: "The acceptance is dated in the future." };
  if (a.termsVersion !== BRAND_SELLER_TERMS_VERSION) return { ok: false, reason: `Terms version ${a.termsVersion} is not the current version (${BRAND_SELLER_TERMS_VERSION}) — ask the brand to accept again.` };
  return { ok: true };
}

export function acceptanceNote(a: TermsAcceptance) {
  return `Self-listed brand: ${a.name} <${a.email.trim().toLowerCase()}> accepted the Wahbayaan brand seller terms (version ${a.termsVersion}) on ${a.acceptedAt!.toISOString()} and uploads the brand's own content.`;
}

export type BrandPermissionPatch = {
  partnership: "authorised";
  permissionGrantedAt: Date;
  permissionGrantedById: string;
  permissionNote: string;
  permissionEvidenceUrl: string | null;
};

/**
 * Turn an acceptance into the brand's permission + partnership fields. The
 * result passes `catalogueDisplayGate` by construction (checked again here).
 */
export function permissionFromAcceptance(
  a: TermsAcceptance | null | undefined,
  opts: { evidenceUrl?: string | null; now?: Date } = {},
): { ok: true; patch: BrandPermissionPatch } | { ok: false; reason: string } {
  const gate = acceptanceGate(a, opts.now);
  if (!gate.ok) return gate;
  const patch: BrandPermissionPatch = {
    partnership: "authorised",
    permissionGrantedAt: a!.acceptedAt!,
    permissionGrantedById: a!.userId!,
    permissionNote: acceptanceNote(a!),
    permissionEvidenceUrl: opts.evidenceUrl ?? null,
  };
  const display = catalogueDisplayGate(patch);
  return display.ok ? { ok: true, patch } : { ok: false, reason: display.reason };
}
