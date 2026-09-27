import { Badge, type Tone } from "@/components/ui/misc";

export const VENDOR_ORDER_LABEL: Record<string, string> = {
  pending: "New — accept it",
  accepted: "Accepted",
  in_production: "Being made",
  ready_to_ship: "Ready to ship",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const TONE: Record<string, Tone> = {
  pending: "terracotta",
  accepted: "indigo",
  in_production: "indigo",
  ready_to_ship: "gold",
  shipped: "turquoise",
  delivered: "success",
  cancelled: "neutral",
};

export function VendorOrderBadge({ status }: { status: string }) {
  return <Badge tone={TONE[status] ?? "neutral"}>{VENDOR_ORDER_LABEL[status] ?? status}</Badge>;
}

const LISTING_TONE: Record<string, Tone> = { draft: "neutral", pending_review: "pending", active: "success", rejected: "danger", archived: "neutral" };
const LISTING_LABEL: Record<string, string> = { draft: "Draft", pending_review: "In review", active: "Live", rejected: "Needs changes", archived: "Archived" };

export function ListingBadge({ status }: { status: string }) {
  return <Badge tone={LISTING_TONE[status] ?? "neutral"}>{LISTING_LABEL[status] ?? status}</Badge>;
}

export const FUNDS_LABEL: Record<string, string> = {
  none: "Not paid yet",
  held: "Held by Wahbayaan",
  frozen: "Frozen — case open",
  released: "Released to you",
  refunded: "Refunded to buyer",
};
