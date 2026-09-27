import type { Tone } from "@/components/ui/misc";

export function humanize(s: string | null | undefined) {
  if (!s) return "—";
  const t = s.replace(/[_.]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const TONES: Record<string, Record<string, Tone>> = {
  vendor: { applied: "neutral", in_review: "pending", verified: "success", suspended: "danger", rejected: "neutral" },
  application: { submitted: "gold", in_review: "pending", more_info: "warning", approved: "success", rejected: "neutral" },
  product: { draft: "neutral", pending_review: "pending", active: "success", rejected: "danger", archived: "neutral" },
  review: { pending: "pending", published: "success", hidden: "neutral" },
  vendorOrder: { pending: "gold", accepted: "indigo", in_production: "indigo", ready_to_ship: "turquoise", shipped: "turquoise", delivered: "success", cancelled: "neutral" },
  payment: { unpaid: "warning", paid: "success", refunded: "neutral", partially_refunded: "gold", failed: "danger" },
  paymentRecord: { pending: "pending", succeeded: "success", failed: "danger", refunded: "neutral" },
  funds: { none: "neutral", held: "indigo", released: "success", refunded: "neutral", frozen: "danger" },
  line: { known: "success", pending: "pending", not_applicable: "neutral" },
  refund: { requested: "pending", approved: "gold", processed: "success", rejected: "neutral" },
  payout: { pending: "gold", scheduled: "indigo", paid: "success", on_hold: "danger", failed: "danger" },
  dispute: { open: "danger", awaiting_seller: "warning", awaiting_buyer: "gold", under_review: "indigo", resolved: "success", closed: "neutral" },
  config: { pending: "pending", active: "success", disabled: "neutral" },
  rate: { placeholder: "pending", manual: "gold", live: "success" },
  rule: { info: "indigo", warning: "warning", restricted: "terracotta", prohibited: "danger" },
  publish: { draft: "neutral", published: "success" },
  request: { new: "gold", quoted: "indigo", accepted: "success", declined: "neutral", expired: "neutral", converted: "success", cancelled: "neutral" },
  ticket: { new: "gold", open: "indigo", resolved: "success" },
  lead: { new: "gold", contacted: "indigo", approved: "success", rejected: "neutral" },
  account: { active: "success", suspended: "danger" },
  check: { pending: "pending", passed: "success", failed: "danger" },
  email: { queued: "pending", sent: "success", failed: "danger", logged: "neutral" },
  certificate: { issued: "success", void: "neutral" },
};

export function toneFor(kind: keyof typeof TONES | string, status: string | null | undefined): Tone {
  return (status && TONES[kind]?.[status]) || "neutral";
}

export const DISPUTE_REASON_LABEL: Record<string, string> = {
  damaged: "Damaged in transit",
  not_as_described: "Not as described",
  not_received: "Not received",
  wrong_item: "Wrong item",
  other: "Other",
};

export const VERIFICATION_LABEL: Record<string, string> = {
  identity: "Identity (CNIC)",
  workshop: "Workshop visit / photos",
  samples: "Sample pieces reviewed",
  video_call: "Video call",
  address: "Workshop address",
};

/** Checks that must all pass before an artisan can be verified. */
export const KEY_VERIFICATION_CHECKS = ["identity", "workshop", "samples"] as const;
