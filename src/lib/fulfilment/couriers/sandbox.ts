import crypto from "node:crypto";
import { CourierAdapterError, type CourierAdapter } from "./types";

/**
 * Sandbox booking for demos and tests: no courier is contacted. The tracking
 * number is derived from our reference (so booking twice gives the same
 * number) and always starts with `SBX` so nobody mistakes it for a real one.
 * Refused in production unless ALLOW_SANDBOX_COURIERS=true.
 */
export function sandboxTrackingNumber(reference: string) {
  const digits = BigInt(`0x${crypto.createHash("sha256").update(reference).digest("hex").slice(0, 15)}`).toString().padStart(12, "0").slice(-12);
  return `SBX${digits}`;
}

export function sandboxAllowed(env: Record<string, string | undefined>) {
  return env.NODE_ENV !== "production" || env.ALLOW_SANDBOX_COURIERS === "true";
}

export const sandboxAdapter: CourierAdapter = {
  id: "sandbox",
  label: "Sandbox — simulated booking (demo / tests)",
  kind: "sandbox",
  available: (env) => (sandboxAllowed(env) ? { ok: true } : { ok: false, reason: "Sandbox bookings are switched off in production." }),
  async bookShipment(req) {
    if (!sandboxAllowed(process.env)) throw new CourierAdapterError("Sandbox bookings are switched off in production.");
    if (!req.reference) throw new CourierAdapterError("A parcel reference is required.");
    if (!req.to.city || !req.from.city) throw new CourierAdapterError("Pickup and delivery cities are required.");
    const trackingNumber = sandboxTrackingNumber(req.reference);
    return { provider: "sandbox", bookingRef: `sandbox:${req.reference}`, trackingNumber, trackingUrl: null };
  },
  async getLabel(req, booking) {
    return {
      kind: "generated",
      reference: req.reference,
      trackingNumber: booking.trackingNumber,
      courierName: req.courierName,
      serviceName: req.serviceName,
      from: req.from,
      to: req.to,
      weightG: req.weightG,
      note: "SANDBOX LABEL — simulated booking, not valid for a real courier",
    };
  },
  async track(trackingNumber) {
    if (!trackingNumber.startsWith("SBX")) return { status: "unknown", events: [], trackingUrl: null };
    return { status: "booked", events: [{ at: new Date(), status: "booked", message: "Booked in the sandbox (no real courier)" }], trackingUrl: null };
  },
};
