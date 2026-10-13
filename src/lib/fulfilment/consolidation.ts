/**
 * Hub consolidation rules. Pure — used by the hub screens, the buyer's order
 * page, checkout estimates and the tests.
 *
 * International orders wait at the hub until every item has arrived and passed
 * QC, then leave in one box. The order therefore waits for the slowest item:
 * the estimated dispatch date is the slowest item's making / dispatch time plus
 * the hub's handling days. A late seller lets staff either keep waiting or ship
 * the ready items now (a partial shipment) — any extra shipping for the second
 * box needs the buyer's approval through a quote.
 */

export type HubParcelStatus = "expected" | "in_transit" | "received" | "qc_passed" | "qc_failed" | "packed" | "shipped" | "returned_to_seller" | "cancelled";

/** Physically at the hub (scanned in), whatever its QC result. */
export const AT_HUB: readonly HubParcelStatus[] = ["received", "qc_passed", "qc_failed", "packed"];
/** Checked and waiting in storage — can go into a box. */
export const READY: readonly HubParcelStatus[] = ["qc_passed"];
/** No longer part of the consolidation (left the hub, or never coming). */
export const CLOSED: readonly HubParcelStatus[] = ["shipped", "returned_to_seller", "cancelled"];

export type ParcelForConsolidation = {
  id: string;
  status: HubParcelStatus;
  /** Items (sum of quantities) inside the parcel. */
  itemCount: number;
  expectedBy?: Date | null;
  senderLabel?: string;
};

export type ConsolidationProgress = {
  totalItems: number;
  arrivedItems: number;
  readyItems: number;
  shippedItems: number;
  totalParcels: number;
  arrivedParcels: number;
  /** Every live parcel is checked and stored: the box can be packed. */
  readyToPack: boolean;
  /** At least one parcel failed QC and needs staff action first. */
  blocked: boolean;
  /** "2 of 3 items arrived". */
  label: string;
};

const live = (p: ParcelForConsolidation) => p.status !== "returned_to_seller" && p.status !== "cancelled";

/** How far an order's consolidation has got. Cancelled / returned parcels don't count. */
export function consolidationProgress(parcels: ParcelForConsolidation[]): ConsolidationProgress {
  const counted = parcels.filter(live);
  const sum = (xs: ParcelForConsolidation[]) => xs.reduce((a, p) => a + Math.max(0, p.itemCount), 0);
  const arrived = counted.filter((p) => AT_HUB.includes(p.status) || p.status === "shipped");
  const pending = counted.filter((p) => p.status !== "shipped" && p.status !== "packed");
  const totalItems = sum(counted);
  const arrivedItems = sum(arrived);
  return {
    totalItems,
    arrivedItems,
    readyItems: sum(counted.filter((p) => READY.includes(p.status))),
    shippedItems: sum(counted.filter((p) => p.status === "shipped")),
    totalParcels: counted.length,
    arrivedParcels: arrived.length,
    readyToPack: pending.length > 0 && pending.every((p) => READY.includes(p.status)),
    blocked: counted.some((p) => p.status === "qc_failed"),
    label: `${arrivedItems} of ${totalItems} item${totalItems === 1 ? "" : "s"} arrived`,
  };
}

// ── Timing ──────────────────────────────────────────────────────────────────

export type TimedItem = {
  availability: "ready_to_ship" | "made_to_order";
  timeToMakeDays: number | null;
  dispatchDays: number | null;
};

/** Days before an item can leave its seller: making time for made-to-order pieces, dispatch time otherwise (as the landed-cost engine does). */
export function itemReadyDays(item: TimedItem): number | null {
  const d = item.availability === "made_to_order" ? item.timeToMakeDays : item.dispatchDays;
  return d == null || d < 0 ? null : d;
}

/** The slowest item decides. Null when any item has no stated time (pending — never guessed). */
export function slowestItemDays(items: TimedItem[]): number | null {
  if (!items.length) return null;
  const days = items.map(itemReadyDays);
  if (days.some((d) => d == null)) return null;
  return Math.max(...(days as number[]));
}

export type DispatchEstimate =
  | { status: "known"; slowestDays: number; handlingDays: number; dispatchAt: Date }
  | { status: "pending"; slowestDays: number | null; handlingDays: number | null; reason: string };

const DAY = 86_400_000;
export const addDays = (from: Date, days: number) => new Date(from.getTime() + days * DAY);

/** Estimated date the consolidated box leaves the hub: start + slowest item + hub handling. */
export function estimateHubDispatch(start: Date, items: TimedItem[], hubHandlingDays: number | null): DispatchEstimate {
  const slowest = slowestItemDays(items);
  if (slowest == null) return { status: "pending", slowestDays: null, handlingDays: hubHandlingDays, reason: "a seller hasn't stated their making or dispatch time" };
  if (hubHandlingDays == null || hubHandlingDays < 0) return { status: "pending", slowestDays: slowest, handlingDays: null, reason: "hub handling time not set yet" };
  return { status: "known", slowestDays: slowest, handlingDays: hubHandlingDays, dispatchAt: addDays(start, slowest + hubHandlingDays) };
}

/** A parcel that hasn't reached the hub more than `thresholdDays` after it was due. */
export function isParcelLate(p: ParcelForConsolidation, now: Date, thresholdDays: number): boolean {
  if (!live(p) || AT_HUB.includes(p.status) || p.status === "shipped") return false;
  if (!p.expectedBy) return false;
  return now.getTime() > p.expectedBy.getTime() + Math.max(0, thresholdDays) * DAY;
}

/** Whole days since a date (ageing on the consolidation board). */
export function ageDays(since: Date | null | undefined, now: Date): number | null {
  if (!since) return null;
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY));
}

// ── Partial shipments ───────────────────────────────────────────────────────

export type PartialShipmentCheck =
  | { allowed: true; ready: ParcelForConsolidation[]; waiting: ParcelForConsolidation[]; late: ParcelForConsolidation[]; extraShippingNeedsApproval: true }
  | { allowed: false; reason: string; ready: ParcelForConsolidation[]; waiting: ParcelForConsolidation[]; late: ParcelForConsolidation[] };

/**
 * May staff ship the ready items now and the rest later?
 * - something must be checked and ready, and something must still be outstanding
 *   (otherwise it's simply a full shipment, or nothing to ship);
 * - an outstanding parcel must be late past the threshold — otherwise the order
 *   waits for the slowest item as promised.
 * The second box costs extra shipping: that is only charged after the buyer
 * approves a quote (`extraShippingNeedsApproval`).
 */
export function partialShipmentCheck(parcels: ParcelForConsolidation[], now: Date, thresholdDays: number): PartialShipmentCheck {
  const counted = parcels.filter((p) => live(p) && p.status !== "shipped" && p.status !== "packed");
  const ready = counted.filter((p) => READY.includes(p.status));
  const waiting = counted.filter((p) => !READY.includes(p.status));
  const late = waiting.filter((p) => isParcelLate(p, now, thresholdDays));
  if (!ready.length) return { allowed: false, reason: "Nothing has been checked and stored yet.", ready, waiting, late };
  if (!waiting.length) return { allowed: false, reason: "Everything is ready — pack it as one box.", ready, waiting, late };
  if (!late.length) return { allowed: false, reason: `No seller is more than ${thresholdDays} day${thresholdDays === 1 ? "" : "s"} late — the order waits for the slowest item.`, ready, waiting, late };
  return { allowed: true, ready, waiting, late, extraShippingNeedsApproval: true };
}

// ── Box weight ──────────────────────────────────────────────────────────────

/** Standard international express divisor (cm³ per kg). Configurable in Admin → Hubs. */
export const DEFAULT_VOLUMETRIC_DIVISOR = 5000;

/** Volumetric ("dimensional") weight in grams: L × W × H (cm) ÷ divisor, in kg. Rounded up to the gram. */
export function volumetricWeightG(lengthCm: number, widthCm: number, heightCm: number, divisor = DEFAULT_VOLUMETRIC_DIVISOR): number {
  if (!(lengthCm > 0 && widthCm > 0 && heightCm > 0) || !(divisor > 0)) return 0;
  return Math.ceil(((lengthCm * widthCm * heightCm) / divisor) * 1000);
}

/** Couriers charge the greater of actual and volumetric weight. */
export function chargeableWeightG(actualG: number, volumetricG: number): number {
  return Math.max(Math.max(0, actualG), Math.max(0, volumetricG));
}

export type BoxItem = { weightG: number | null; qty: number; widthCm?: number | null; heightCm?: number | null; depthCm?: number | null };

export type BoxEstimate =
  | { status: "known"; actualG: number; volumetricG: number; chargeableG: number }
  | { status: "pending"; reason: string };

/**
 * Checkout estimate for the consolidated box from listed weights and sizes.
 * Volumetric weight uses the items' combined volume (a lower bound — the packed
 * box is weighed and measured at the hub; if it costs more, the buyer is asked
 * to approve the difference first).
 */
export function estimateConsolidatedBox(items: BoxItem[], divisor = DEFAULT_VOLUMETRIC_DIVISOR): BoxEstimate {
  if (!items.length) return { status: "pending", reason: "no items" };
  if (items.some((i) => !i.weightG || i.weightG <= 0)) return { status: "pending", reason: "shipping weight not listed for every item" };
  const actualG = items.reduce((a, i) => a + i.weightG! * i.qty, 0);
  const volumeCm3 = items.reduce((a, i) => (i.widthCm && i.heightCm && i.depthCm ? a + i.widthCm * i.heightCm * i.depthCm * i.qty : a), 0);
  const volumetricG = divisor > 0 ? Math.ceil((volumeCm3 / divisor) * 1000) : 0;
  return { status: "known", actualG, volumetricG, chargeableG: chargeableWeightG(actualG, volumetricG) };
}

/**
 * Final box vs. what the buyer paid for shipping. More expensive → staff send a
 * quote for the difference (never charged silently); cheaper or equal → nothing
 * to charge.
 */
export function finalShippingDelta(chargedShipping: number | null, finalShipping: number | null): { action: "none" | "quote" | "pending"; difference: number } {
  if (finalShipping == null || chargedShipping == null) return { action: "pending", difference: 0 };
  const difference = finalShipping - chargedShipping;
  return difference > 0 ? { action: "quote", difference } : { action: "none", difference };
}
