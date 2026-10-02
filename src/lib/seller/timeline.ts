/**
 * Which order events an artisan sees on their parcel's timeline. Pure.
 *
 * The order timeline is shared by buyer, artisan and staff. Some events are
 * written for the buyer and carry buyer-currency amounts ("Final total
 * confirmed: $106.44 …", "Refund of $X issued") — the seller dashboard is
 * rupees-only, so those stay off it. Internal staff notes (not visible to the
 * buyer) are hidden too, unless they are about this artisan's own parcel
 * (e.g. "payout waiting for the commission rate").
 */
export const BUYER_ONLY_EVENT_KINDS = new Set(["awaiting_quote", "quote", "refund"]);

export function sellerSeesEvent(e: { kind: string; visibleToBuyer: boolean; vendorOrderId: string | null }, vendorOrderId: string): boolean {
  if (e.vendorOrderId && e.vendorOrderId !== vendorOrderId) return false;
  if (BUYER_ONLY_EVENT_KINDS.has(e.kind)) return false;
  if (!e.visibleToBuyer && e.vendorOrderId !== vendorOrderId) return false;
  return true;
}
