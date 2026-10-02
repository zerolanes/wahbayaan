import { describe, expect, it } from "vitest";
import { sellerSeesEvent } from "@/lib/seller/timeline";

const VO = "vo-1";
const ev = (kind: string, visibleToBuyer = true, vendorOrderId: string | null = null) => ({ kind, visibleToBuyer, vendorOrderId });

describe("seller order timeline", () => {
  it("hides buyer-only events that carry buyer-currency amounts", () => {
    expect(sellerSeesEvent(ev("quote"), VO)).toBe(false); // "Final total confirmed: $106.44 …"
    expect(sellerSeesEvent(ev("refund"), VO)).toBe(false); // "Refund of $X issued"
    expect(sellerSeesEvent(ev("awaiting_quote"), VO)).toBe(false);
  });

  it("shows the shared lifecycle events", () => {
    for (const kind of ["placed", "paid", "delivered", "released", "dispute", "cancelled"]) expect(sellerSeesEvent(ev(kind), VO)).toBe(true);
    expect(sellerSeesEvent(ev("vendor_ship", true, VO), VO)).toBe(true);
  });

  it("hides other artisans' parcels and internal staff notes, but keeps notes about this parcel", () => {
    expect(sellerSeesEvent(ev("vendor_ship", true, "vo-2"), VO)).toBe(false);
    expect(sellerSeesEvent(ev("funds_frozen", false), VO)).toBe(false);
    expect(sellerSeesEvent(ev("staff_update", false), VO)).toBe(false);
    expect(sellerSeesEvent(ev("payout_pending", false, VO), VO)).toBe(true);
  });
});
