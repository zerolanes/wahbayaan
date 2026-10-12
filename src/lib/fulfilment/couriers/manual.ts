import { buildTrackingUrl } from "@/lib/brands/domestic";
import { CourierAdapterError, type CourierAdapter } from "./types";

/**
 * Manual booking: the seller or staff book with the courier (counter, phone,
 * the courier's own portal) and type the tracking number here. The tracking
 * link is built from the courier's URL template; the label is ours.
 */
export const manualAdapter: CourierAdapter = {
  id: "manual",
  label: "Manual — enter the tracking number",
  kind: "manual",
  available: () => ({ ok: true }),
  async bookShipment(req) {
    const tracking = req.trackingNumber?.trim();
    if (!tracking) throw new CourierAdapterError("Enter the tracking number the courier gave you.");
    if (tracking.length > 60 || !/^[A-Za-z0-9-]+$/.test(tracking)) throw new CourierAdapterError("Tracking numbers use letters, digits and dashes only.");
    return { provider: "manual", bookingRef: `manual:${req.reference}`, trackingNumber: tracking, trackingUrl: buildTrackingUrl(req.trackingUrlTemplate, tracking) };
  },
  async getLabel(req, booking) {
    return { kind: "generated", reference: req.reference, trackingNumber: booking.trackingNumber, courierName: req.courierName, serviceName: req.serviceName, from: req.from, to: req.to, weightG: req.weightG };
  },
  async track(trackingNumber, ctx) {
    // No courier API: the buyer and staff follow the courier's own tracking page.
    return { status: "unknown", events: [], trackingUrl: buildTrackingUrl(ctx.trackingUrlTemplate, trackingNumber) };
  },
};
