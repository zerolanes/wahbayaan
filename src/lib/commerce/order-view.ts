/**
 * Buyer-side presentation of an order: the landed cost "as charged" (or as
 * known so far), the journey stepper and which actions the buyer may take.
 * Pure — the state machine itself lives in `orders.ts`.
 */
export type LineState = "known" | "pending" | "not_applicable";

export type OrderCostSource = {
  itemsSubtotal: number;
  shippingAmount: number | null;
  shippingStatus: LineState;
  dutyAmount: number | null;
  dutyStatus: LineState;
  importTaxAmount: number | null;
  importTaxStatus: LineState;
  handlingAmount: number | null;
  handlingStatus: LineState;
  giftWrap: boolean;
  giftWrapAmount: number | null;
  discountAmount: number;
  total: number;
  totalComplete: boolean;
};

export type OrderCostLine = { key: string; label: string; status: LineState; amount: number | null; note?: string };

export function orderCostLines(o: OrderCostSource): { lines: OrderCostLine[]; total: number; complete: boolean; pendingCount: number } {
  const line = (key: string, label: string, status: LineState, amount: number | null, notes?: Partial<Record<LineState, string>>): OrderCostLine => ({
    key,
    label,
    status: status === "known" && amount == null ? "pending" : status,
    amount: status === "known" ? amount : null,
    note: notes?.[status],
  });
  const lines: OrderCostLine[] = [
    { key: "items", label: "Items", status: "known", amount: o.itemsSubtotal },
    line("shipping", "International shipping", o.shippingStatus, o.shippingAmount, { pending: "Being confirmed by our team" }),
    line("duty", "Import duty", o.dutyStatus, o.dutyAmount, { pending: "Being confirmed by our team" }),
    line("import_tax", "Import tax", o.importTaxStatus, o.importTaxAmount, { pending: "Confirmed together with duty", not_applicable: "No import tax applies" }),
    line("handling", "Wahbayaan handling", o.handlingStatus, o.handlingAmount, { pending: "Being confirmed by our team", not_applicable: "No handling fee" }),
  ];
  if (o.giftWrap) lines.push(line("gift_wrap", "Gift wrap", o.giftWrapAmount == null ? "pending" : "known", o.giftWrapAmount));
  if (o.discountAmount > 0) lines.push({ key: "discount", label: "Discount", status: "known", amount: -o.discountAmount });
  const pendingCount = lines.filter((l) => l.status === "pending").length;
  return { lines, total: o.total, complete: o.totalComplete && pendingCount === 0, pendingCount };
}

/** "international shipping, import duty and Wahbayaan handling" — for sentences about pending lines. */
export function joinCostLabels(labels: string[]) {
  const words = labels.map((l) => (/^Wahbayaan/.test(l) ? l : l.charAt(0).toLowerCase() + l.slice(1)));
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

export const ORDER_JOURNEY = [
  { key: "placed", label: "Order placed", detail: "Your pieces are reserved." },
  { key: "paid", label: "Paid — funds held", detail: "Wahbayaan holds your payment; the artisan isn't paid yet." },
  { key: "making", label: "Made & packed", detail: "The artisan makes or finishes your piece and packs it for export." },
  { key: "shipped", label: "Shipped", detail: "Export paperwork done; the courier carries it to your country and through customs." },
  { key: "delivered", label: "Delivered", detail: "Check it arrived as described." },
  { key: "completed", label: "Confirmed — artisan paid", detail: "Held funds are released to the artisan." },
] as const;

/** Index of the current journey step, or -1 for closed orders (cancelled/refunded). */
export function orderJourneyStep(status: string): number {
  switch (status) {
    case "awaiting_quote":
    case "quote_sent":
    case "awaiting_payment":
      return 0;
    case "paid":
      return 1;
    case "in_fulfilment":
      return 2;
    case "shipped":
      return 3;
    case "delivered":
    case "disputed":
      return 4;
    case "completed":
      return 5;
    default:
      return -1;
  }
}

export type BuyerOrderState = {
  status: string;
  paymentStatus: string;
  totalComplete: boolean;
  vendorStatuses: string[];
  hasOpenDispute: boolean;
};

export function buyerOrderActions(o: BuyerOrderState) {
  const closed = ["cancelled", "refunded", "completed"].includes(o.status);
  const anyShipped = o.vendorStatuses.some((s) => s === "shipped" || s === "delivered");
  return {
    canPay: o.totalComplete && ["quote_sent", "awaiting_payment"].includes(o.status) && o.paymentStatus !== "paid",
    canConfirmDelivery: ["shipped", "delivered"].includes(o.status),
    canOpenCase: o.paymentStatus === "paid" && ["paid", "in_fulfilment", "shipped", "delivered"].includes(o.status) && !o.hasOpenDispute,
    canCancel: !closed && !anyShipped && !["shipped", "delivered", "disputed"].includes(o.status),
  };
}

export const DISPUTE_STEPS = [
  { key: "open", label: "Case opened" },
  { key: "talking", label: "Talking it through" },
  { key: "review", label: "Under review" },
  { key: "resolved", label: "Resolved" },
] as const;

export function disputeStep(status: string) {
  switch (status) {
    case "open":
      return 0;
    case "awaiting_seller":
    case "awaiting_buyer":
      return 1;
    case "under_review":
      return 2;
    case "resolved":
    case "closed":
      return 3;
    default:
      return 0;
  }
}

export const DISPUTE_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  awaiting_seller: "Waiting for the artisan",
  awaiting_buyer: "Waiting for you",
  under_review: "Under review",
  resolved: "Resolved",
  closed: "Closed",
};

export const DISPUTE_REASON_LABEL: Record<string, string> = {
  damaged: "Arrived damaged",
  not_as_described: "Not as described",
  not_received: "Never arrived",
  wrong_item: "Wrong item",
  other: "Something else",
};
