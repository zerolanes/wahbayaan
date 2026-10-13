import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { hubParcels, orderItems, shipments, users } from "@/lib/db/schema";
import { hubParty } from "@/lib/fulfilment/service";
import { renderLabelHtml, type LabelInput } from "@/lib/fulfilment/label";
import type { Party } from "@/lib/fulfilment/couriers/types";
import { getSetting } from "@/lib/settings";

/**
 * Printable label for a parcel reference (manual / sandbox bookings):
 * - seller → hub inbound label (hub parcels),
 * - seller → buyer direct parcel,
 * - hub → buyer consolidated box.
 * Staff with hub or order access, or the seller who owns the parcel.
 */
export async function GET(_req: Request, ctx: RouteContext<"/labels/[ref]">) {
  const { ref } = await ctx.params;
  const reference = decodeURIComponent(ref).toUpperCase();
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to print labels", { status: 401 });
  const isStaff = user.role === "staff" && (user.permissions.has("hub.operate") || user.permissions.has("orders.view"));
  const d = await db();

  const buyer = (a: { fullName: string; line1: string; line2?: string | null; city: string; region?: string | null; postalCode?: string | null; country: string; phone?: string | null }): Party => ({
    name: a.fullName,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    region: a.region,
    postalCode: a.postalCode,
    country: a.country,
    phone: a.phone,
  });
  const seller = async (v: { displayName: string; workshopCity: string | null; userId: string }): Promise<Party> => {
    const u = await d.query.users.findFirst({ where: eq(users.id, v.userId), columns: { phone: true } });
    return { name: v.displayName, line1: `${v.displayName} workshop`, city: v.workshopCity ?? "Pakistan", country: "PK", phone: u?.phone ?? null };
  };
  const sandboxNote = (provider: string | null) => (provider === "sandbox" ? "SANDBOX LABEL — simulated booking, not valid for a real courier" : null);
  let label: LabelInput | null = null;

  const sh = await d.query.shipments.findFirst({ where: eq(shipments.reference, reference), with: { order: true, vendorOrder: { with: { vendor: true } }, fromHub: true, items: true } });
  if (sh && sh.status !== "cancelled") {
    if (!isStaff && !(sh.vendorOrder && user.vendorId === sh.vendorOrder.vendorId)) return new Response("Not found", { status: 404 });
    const from = sh.fromHub ? hubParty(sh.fromHub) : sh.vendorOrder ? await seller(sh.vendorOrder.vendor) : { name: "Wahbayaan", line1: "", city: "", country: "PK" };
    label = {
      title: sh.kind === "direct" ? "Deliver to buyer" : sh.kind === "partial" ? "Export — part shipment" : "Export — one box",
      reference: sh.reference,
      orderNumber: sh.order.number,
      courierName: sh.courierName,
      serviceName: sh.serviceName,
      trackingNumber: sh.trackingNumber,
      from,
      to: buyer(sh.order.shippingAddress),
      weightG: sh.weightG,
      itemCount: sh.items.reduce((a, i) => a + i.qty, 0),
      note: sandboxNote(sh.provider),
      instructions: sh.kind === "direct" ? ["Hand the sealed parcel to the courier.", "Keep the courier's receipt."] : ["Commercial invoice and packing list go in the document pouch."],
    };
  } else {
    const p = await d.query.hubParcels.findFirst({ where: eq(hubParcels.reference, reference), with: { hub: true, order: true, vendorOrder: { with: { vendor: true } } } });
    if (!p || p.status === "cancelled") return new Response("Not found", { status: 404 });
    if (!isStaff && !(p.vendorOrder && user.vendorId === p.vendorOrder.vendorId)) return new Response("Not found", { status: 404 });
    const items = p.vendorOrderId ? await d.select({ qty: orderItems.qty }).from(orderItems).where(eq(orderItems.vendorOrderId, p.vendorOrderId)) : [];
    const { dropOffInstructions } = await getSetting("fulfilment");
    label = {
      title: "Send to Wahbayaan hub",
      reference: p.reference,
      orderNumber: p.order.number,
      courierName: p.courier,
      trackingNumber: p.trackingNumber,
      from: p.vendorOrder ? await seller(p.vendorOrder.vendor) : { name: p.senderLabel, line1: "", city: p.senderCity ?? "", country: "PK" },
      to: hubParty(p.hub),
      weightG: null,
      itemCount: items.reduce((a, i) => a + i.qty, 0) || 1,
      note: sandboxNote(p.provider),
      instructions: [
        `Write ${p.reference} clearly on the box as well.`,
        "Don't put prices or the buyer's address inside — the hub repacks for export.",
        ...(p.hub.receivingHours ? [`Hub receiving hours: ${p.hub.receivingHours}${p.hub.cutoffTime ? ` (cut-off ${p.hub.cutoffTime})` : ""}.`] : []),
        ...(dropOffInstructions ? [dropOffInstructions] : []),
      ],
    };
  }
  return new Response(renderLabelHtml(label), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } });
}
