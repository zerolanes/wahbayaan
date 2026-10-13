/**
 * Courier booking adapters.
 *
 * Every courier in Admin → Couriers is booked through one adapter:
 * - `manual`  — staff or the seller book with the courier themselves and type
 *               the tracking number; the tracking link comes from the courier's
 *               URL template (Admin → Couriers). Works for every courier today.
 * - `sandbox` — fakes a booking (deterministic tracking number, generated label)
 *               for demos and tests. Refused in production.
 * - real providers (TCS, Leopards, M&P, PostEx, Trax, DHL, FedEx, Aramex …) —
 *               extension points only, see ./providers.ts. Nothing here calls a
 *               courier API until an integration is written against the
 *               courier's own documentation and contract credentials.
 */

export type Party = {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode?: string | null;
  country: string;
  phone?: string | null;
};

export type BookingRequest = {
  /** Our parcel / shipment reference (printed on the label, used as the courier's customer reference). */
  reference: string;
  courierName: string;
  serviceName?: string | null;
  from: Party;
  to: Party;
  weightG: number | null;
  dimensionsCm?: { length: number; width: number; height: number } | null;
  /** Declared value for customs / insurance, in a currency the courier accepts. */
  declaredValue?: { amount: number; currency: string } | null;
  contents?: string | null;
  /** Manual adapter: the tracking number the person typed. */
  trackingNumber?: string | null;
  /** Courier's tracking URL template, e.g. https://courier.example/track?n={tracking}. */
  trackingUrlTemplate?: string | null;
};

export type BookingResult = {
  provider: string;
  bookingRef: string;
  trackingNumber: string;
  trackingUrl: string | null;
};

/** Data for a label we render ourselves (manual / sandbox), or a provider's own label file. */
export type LabelResult =
  | { kind: "generated"; reference: string; trackingNumber: string | null; courierName: string; serviceName?: string | null; from: Party; to: Party; weightG: number | null; note?: string }
  | { kind: "provider_file"; url: string; mime: "application/pdf" | "image/png" | "text/html" };

export type TrackingEvent = { at: Date; status: TrackStatus; message: string };
export type TrackStatus = "unknown" | "booked" | "in_transit" | "delivered" | "exception";
export type TrackResult = { status: TrackStatus; events: TrackingEvent[]; trackingUrl: string | null };

export interface CourierAdapter {
  id: string;
  label: string;
  kind: "manual" | "sandbox" | "api";
  /** Whether the adapter can be used in this environment (credentials, production guard). */
  available(env: Record<string, string | undefined>): { ok: true } | { ok: false; reason: string };
  bookShipment(req: BookingRequest): Promise<BookingResult>;
  getLabel(req: BookingRequest, booking: BookingResult): Promise<LabelResult>;
  track(trackingNumber: string, ctx: { trackingUrlTemplate?: string | null }): Promise<TrackResult>;
}

export class CourierAdapterError extends Error {}
