/**
 * Buyer-facing journey of each item. Pure.
 *
 *   hub (international):  with the seller → on the way to our hub → at our hub (checked) → packed → shipped → delivered
 *   direct (one parcel per seller): with the seller → booked → on its way → delivered
 */
import type { HubParcelStatus } from "./consolidation";

export const HUB_JOURNEY = [
  { key: "seller", label: "With the seller" },
  { key: "to_hub", label: "On the way to our hub" },
  { key: "at_hub", label: "At our hub" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
] as const;

export const DIRECT_JOURNEY = [
  { key: "seller", label: "With the seller" },
  { key: "booked", label: "Courier booked" },
  { key: "shipped", label: "On its way" },
  { key: "delivered", label: "Delivered" },
] as const;

export type JourneyPoint = { step: number; label: string; detail?: string };

/** Where an item travelling through the hub is, from its inbound parcel and outbound shipment. */
export function hubItemJourney(parcel: HubParcelStatus | null, shipment: "draft" | "booked" | "shipped" | "delivered" | "cancelled" | null): JourneyPoint {
  if (shipment === "delivered") return { step: 5, label: "Delivered" };
  if (shipment === "shipped" || parcel === "shipped") return { step: 4, label: "Shipped" };
  switch (parcel) {
    case "packed":
      return { step: 3, label: "Packed" };
    case "qc_passed":
      return { step: 2, label: "At our hub", detail: "Checked" };
    case "received":
      return { step: 2, label: "At our hub", detail: "Being checked" };
    case "qc_failed":
      return { step: 2, label: "At our hub", detail: "We're sorting something out with the seller" };
    case "in_transit":
      return { step: 1, label: "On the way to our hub" };
    case "returned_to_seller":
      return { step: 0, label: "With the seller", detail: "Sent back to the seller to be put right" };
    case "cancelled":
      return { step: 0, label: "Cancelled" };
    default:
      return { step: 0, label: "With the seller" };
  }
}

/** A seller's parcel shipped straight to the buyer. */
export function directParcelJourney(vendorStatus: string, shipment: "draft" | "booked" | "shipped" | "delivered" | "cancelled" | null): JourneyPoint {
  if (vendorStatus === "delivered" || shipment === "delivered") return { step: 3, label: "Delivered" };
  if (vendorStatus === "shipped" || shipment === "shipped") return { step: 2, label: "On its way" };
  if (shipment === "booked") return { step: 1, label: "Courier booked" };
  if (vendorStatus === "cancelled") return { step: 0, label: "Cancelled" };
  return { step: 0, label: "With the seller" };
}
