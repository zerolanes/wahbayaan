"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { couriers, hubs, orders, returnRequests } from "@/lib/db/schema";
import { adminAction, AdminError, files } from "@/lib/admin/action";
import { orderMoney } from "@/lib/admin/money";
import { zBool, zIds, zMoney, zOptDate, zOptInt, zOptNum, zOptStr, zStr, zUuid } from "@/lib/admin/zod";
import { sendEmail } from "@/lib/email";
import { adapterChoices } from "@/lib/fulfilment/couriers/registry";
import {
  createFulfilmentQuote,
  decideConsolidation,
  decideReturn,
  findParcel,
  markShipmentDelivered,
  packAndShip,
  qcParcel,
  receiveParcel,
  refundReturn,
  sendParcelBackToSeller,
  setParcelBin,
  setParcelDueDate,
  updateReturn,
  vendorContact,
} from "@/lib/fulfilment/service";
import { getSetting, setSetting } from "@/lib/settings";
import { saveUploads } from "@/lib/storage";

// ── Hubs (configuration) ────────────────────────────────────────────────────

const hubSchema = z.object({
  name: zStr(120),
  type: z.enum(["origin", "city", "forwarder"]),
  city: zStr(80),
  country: z.string().trim().toUpperCase().length(2, "Use the 2-letter country code, e.g. PK or US"),
  line1: zStr(200),
  line2: zOptStr(200),
  region: zOptStr(80),
  postalCode: zOptStr(20),
  contactName: zOptStr(120),
  contactPhone: zOptStr(40),
  contactEmail: zOptStr(160),
  receivingHours: zOptStr(160),
  cutoffTime: zOptStr(10),
  handlingDays: zOptInt(0, 60),
  onwardCourierId: z.preprocess((v) => (v === "" ? null : v), zUuid.nullable().optional()),
  consolidationCadence: zOptStr(120),
  notes: zOptStr(2000),
  isActive: zBool,
});

function hubValues(data: z.output<typeof hubSchema>) {
  if (data.type !== "forwarder" && data.country !== "PK") throw new AdminError("Origin and city hubs are in Pakistan (PK). A partner abroad is a forwarder.");
  if (data.type === "forwarder" && data.country === "PK") throw new AdminError("A forwarder is in the destination country (e.g. US), not Pakistan.");
  if (data.cutoffTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.cutoffTime)) throw new AdminError("Cut-off time uses 24-hour HH:MM, e.g. 15:00.");
  return {
    name: data.name,
    type: data.type,
    city: data.city,
    country: data.country,
    address: { line1: data.line1, line2: data.line2, city: data.city, region: data.region, postalCode: data.postalCode, country: data.country },
    contactName: data.contactName,
    contactPhone: data.contactPhone,
    contactEmail: data.contactEmail,
    receivingHours: data.receivingHours,
    cutoffTime: data.cutoffTime,
    handlingDays: data.handlingDays,
    onwardCourierId: data.type === "forwarder" ? (data.onwardCourierId ?? null) : null,
    consolidationCadence: data.type === "forwarder" ? data.consolidationCadence : null,
    notes: data.notes,
    isActive: data.isActive,
  };
}

export const createHubAction = adminAction("hubs.manage", hubSchema, async ({ data, audit }) => {
  const d = await db();
  const [row] = await d.insert(hubs).values(hubValues(data)).returning();
  await audit({ action: "hub.create", entity: "hub", entityId: row.id, summary: `Created ${data.type} hub ${data.name} (${data.city}, ${data.country})${data.isActive ? " — active" : ""}`, data });
  return { message: `Hub ${row.name} created` };
});

export const updateHubAction = adminAction("hubs.manage", hubSchema.extend({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const before = await d.query.hubs.findFirst({ where: eq(hubs.id, data.id) });
  if (!before) throw new AdminError("Hub not found");
  await d.update(hubs).set(hubValues(data)).where(eq(hubs.id, data.id));
  await audit({ action: "hub.update", entity: "hub", entityId: data.id, summary: `Updated hub ${data.name}`, data: { before, after: data } });
  return { message: "Hub saved" };
});

export const toggleHubAction = adminAction("hubs.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const h = await d.query.hubs.findFirst({ where: eq(hubs.id, data.id) });
  if (!h) throw new AdminError("Hub not found");
  await d.update(hubs).set({ isActive: !h.isActive }).where(eq(hubs.id, h.id));
  await audit({ action: h.isActive ? "hub.deactivate" : "hub.activate", entity: "hub", entityId: h.id, summary: `${h.isActive ? "Deactivated" : "Activated"} hub ${h.name}` });
  return { message: h.isActive ? `${h.name} switched off — new international orders ship direct unless another hub is active` : `${h.name} is active — new international orders consolidate here` };
});

export const saveFulfilmentSettingsAction = adminAction(
  "hubs.manage",
  z.object({
    consolidateInternational: zBool,
    lateThresholdDays: zOptInt(0, 60),
    volumetricDivisor: zOptInt(1000, 10_000),
    cityHubs: zBool,
    forwarders: zBool,
    dropOffInstructions: zOptStr(2000),
  }),
  async ({ data, audit }) => {
    const cur = await getSetting("fulfilment");
    const next = {
      ...cur,
      consolidateInternational: data.consolidateInternational,
      lateThresholdDays: data.lateThresholdDays ?? cur.lateThresholdDays,
      volumetricDivisor: data.volumetricDivisor ?? cur.volumetricDivisor,
      cityHubs: data.cityHubs,
      forwarders: data.forwarders,
      dropOffInstructions: data.dropOffInstructions,
    };
    await setSetting("fulfilment", next);
    await audit({ action: "settings.fulfilment", entity: "setting", entityId: "fulfilment", summary: "Updated consolidation settings", data: { before: cur, after: next } });
    return { message: "Consolidation settings saved" };
  },
);

export const saveCourierAdaptersAction = adminAction("hubs.manage", z.object({}), async ({ formData, audit }) => {
  const d = await db();
  const rows = await d.select().from(couriers);
  const allowed = new Set(adapterChoices().map((c) => c.id));
  const cur = await getSetting("fulfilment");
  const map: Record<string, string> = {};
  for (const c of rows) {
    const v = String(formData.get(`adapter_${c.id}`) ?? "manual");
    if (!allowed.has(v)) throw new AdminError(`Unknown booking method for ${c.name}`);
    if (v !== "manual") map[c.id] = v;
  }
  await setSetting("fulfilment", { ...cur, courierAdapters: map });
  await audit({ action: "settings.courier_adapters", entity: "setting", entityId: "fulfilment", summary: "Updated courier booking methods", data: { before: cur.courierAdapters, after: map } });
  return { message: "Courier booking methods saved" };
});

// ── Hub operations ──────────────────────────────────────────────────────────

export const receiveParcelAction = adminAction("hub.operate", z.object({ reference: zStr(80), weightKg: zOptNum(0, 500) }), async ({ data, user, audit }) => {
  const parcel = await findParcel(data.reference);
  if (!parcel) throw new AdminError(`No parcel matches “${data.reference}”. Check the code — references end in a check character.`);
  const { progress } = await receiveParcel(parcel.id, { userId: user.id, isStaff: true }, { weightG: data.weightKg == null ? null : Math.round(data.weightKg * 1000) });
  await audit({ action: "hub.receive", entity: "hub_parcel", entityId: parcel.id, summary: `Received ${parcel.reference} from ${parcel.senderLabel}` });
  return { message: `Received ${parcel.reference} (${parcel.senderLabel}) — ${progress.label}. Next: QC.` };
});

export const qcParcelAction = adminAction(
  "hub.operate",
  z.object({ parcelId: zUuid, result: z.enum(["pass", "fail"]), notes: zOptStr(2000), bin: zOptStr(40) }),
  async ({ data, user, formData, audit }) => {
    const photos = await saveUploads(files(formData, "photos"), { uploadedById: user.id });
    const progress = await qcParcel(data.parcelId, { userId: user.id, isStaff: true }, { result: data.result, notes: data.notes, photos, bin: data.bin });
    await audit({ action: `hub.qc_${data.result}`, entity: "hub_parcel", entityId: data.parcelId, summary: `QC ${data.result === "pass" ? "passed" : "failed"}${data.bin ? ` — stored in ${data.bin}` : ""}${photos.length ? ` (${photos.length} photo${photos.length === 1 ? "" : "s"})` : ""}`, data: { notes: data.notes, photos } });
    return { message: data.result === "pass" ? (progress.readyToPack ? "QC passed — everything for this order is in. Ready to pack." : `QC passed — ${progress.label}`) : "QC failed — the seller has been emailed" };
  },
);

export const setBinAction = adminAction("hub.operate", z.object({ parcelId: zUuid, bin: zOptStr(40) }), async ({ data, audit }) => {
  await setParcelBin(data.parcelId, data.bin);
  await audit({ action: "hub.bin", entity: "hub_parcel", entityId: data.parcelId, summary: `Stored in ${data.bin ?? "—"}` });
  return { message: "Location saved" };
});

export const parcelDueAction = adminAction("hub.operate", z.object({ parcelId: zUuid, due: zOptDate }), async ({ data, audit }) => {
  const p = await setParcelDueDate(data.parcelId, data.due);
  await audit({ action: "hub.due_date", entity: "hub_parcel", entityId: p.id, summary: `${p.reference}: seller's hand-over date set to ${data.due ? data.due.toISOString().slice(0, 10) : "not stated"}` });
  return { message: "Due date saved" };
});

export const sendBackAction = adminAction("hub.operate", z.object({ parcelId: zUuid, note: zStr(1000) }), async ({ data, user, audit }) => {
  await sendParcelBackToSeller(data.parcelId, { userId: user.id, isStaff: true }, data.note);
  await audit({ action: "hub.send_back", entity: "hub_parcel", entityId: data.parcelId, summary: `Sent back to seller: ${data.note}` });
  return { message: "Marked as sent back — the hub expects it again" };
});

export const consolidationDecisionAction = adminAction(
  "hub.operate",
  z.object({ orderId: zUuid, decision: z.enum(["wait", "ship_partial"]), note: zOptStr(1000) }),
  async ({ data, user, audit }) => {
    await decideConsolidation(data.orderId, { userId: user.id, isStaff: true }, data.decision, data.note);
    await audit({ action: `hub.decision_${data.decision}`, entity: "order", entityId: data.orderId, summary: data.decision === "wait" ? "Decided to wait for all items" : "Decided to ship the ready items now", data });
    return { message: data.decision === "wait" ? "Waiting — the buyer has been told" : "Partial shipment allowed — the buyer has been told. Pack the ready parcels." };
  },
);

export const remindSellerAction = adminAction("hub.operate", z.object({ vendorOrderId: zUuid, orderNumber: zStr(40) }), async ({ data, audit }) => {
  const c = await vendorContact(data.vendorOrderId);
  if (!c) throw new AdminError("Seller not found");
  await sendEmail({
    to: c.email,
    subject: `Order ${data.orderNumber}: please send your parcel to our hub`,
    template: "vendor_hub_reminder",
    body: `Salaam ${c.name},\n\nThe rest of order ${data.orderNumber} is waiting at our hub for your piece. Please send it as soon as you can, or reply if you need more time.\n\n${process.env.APP_URL ?? "http://localhost:3000"}/seller/orders/${data.vendorOrderId}`,
  });
  await audit({ action: "hub.remind_seller", entity: "vendor_order", entityId: data.vendorOrderId, summary: `Reminded ${c.name} about ${data.orderNumber}` });
  return { message: `Reminder emailed to ${c.name}` };
});

export const packShipAction = adminAction(
  "hub.operate",
  z.object({
    orderId: zUuid,
    parcelIds: zIds,
    weightKg: zOptNum(0.01, 500),
    lengthCm: zOptNum(1, 400),
    widthCm: zOptNum(1, 400),
    heightCm: zOptNum(1, 400),
    courierName: zStr(120),
    serviceName: zOptStr(120),
    method: z.enum(["book", "manual"]),
    trackingNumber: zOptStr(60),
    notes: zOptStr(1000),
  }),
  async ({ data, user, audit }) => {
    if (data.weightKg == null || data.lengthCm == null || data.widthCm == null || data.heightCm == null) throw new AdminError("Enter the packed box's weight and all three dimensions.");
    const r = await packAndShip(data.orderId, { userId: user.id, isStaff: true }, {
      parcelIds: data.parcelIds,
      weightG: Math.round(data.weightKg * 1000),
      lengthCm: data.lengthCm,
      widthCm: data.widthCm,
      heightCm: data.heightCm,
      courierName: data.courierName,
      serviceName: data.serviceName,
      useAdapter: data.method === "book",
      trackingNumber: data.trackingNumber,
      notes: data.notes,
    });
    await audit({
      action: r.partial ? "hub.ship_partial" : "hub.ship",
      entity: "shipment",
      entityId: r.shipment.id,
      summary: `Shipped ${r.shipment.reference} with ${r.shipment.courierName} (${r.shipment.trackingNumber}) — ${(r.chargeableG / 1000).toFixed(2)} kg chargeable`,
      data: { ...data, volumetricG: r.volumetricG, chargeableG: r.chargeableG, rateCostPkr: r.rate?.amountPkr ?? null },
    });
    return { message: `Shipped ${r.shipment.reference} — tracking ${r.shipment.trackingNumber}. The buyer has been emailed.` };
  },
);

export const shipmentDeliveredAction = adminAction("hub.operate", z.object({ shipmentId: zUuid }), async ({ data, user, audit }) => {
  await markShipmentDelivered(data.shipmentId, { userId: user.id, isStaff: true });
  await audit({ action: "shipment.delivered", entity: "shipment", entityId: data.shipmentId, summary: "Marked delivered" });
  return { message: "Delivered — the buyer-protection window has started" };
});

export const extraShippingQuoteAction = adminAction(
  "orders.manage",
  z.object({ orderId: zUuid, kind: z.enum(["partial_shipment", "final_weight"]), amount: zMoney, note: zOptStr(1000) }),
  async ({ data, user, audit }) => {
    const d = await db();
    const o = await d.query.orders.findFirst({ where: eq(orders.id, data.orderId) });
    if (!o) throw new AdminError("Order not found");
    await createFulfilmentQuote(o.id, { userId: user.id, isStaff: true }, { kind: data.kind, amount: data.amount, note: data.note });
    await audit({ action: "order.extra_shipping_quote", entity: "order", entityId: o.id, summary: `Asked the buyer to approve extra shipping of ${orderMoney(data.amount, o.currency)}`, data });
    return { message: `Sent to the buyer for approval — ${orderMoney(data.amount, o.currency)}. Nothing is charged unless they approve.` };
  },
);

// ── Returns ─────────────────────────────────────────────────────────────────

export const decideReturnAction = adminAction("orders.manage", z.object({ id: zUuid, decision: z.enum(["approve", "reject"]), note: zOptStr(1000) }), async ({ data, user, audit }) => {
  await decideReturn(data.id, { userId: user.id, isStaff: true }, data.decision === "approve", data.note);
  await audit({ action: `return.${data.decision}`, entity: "return", entityId: data.id, summary: `${data.decision === "approve" ? "Approved" : "Rejected"} return${data.note ? `: ${data.note}` : ""}` });
  return { message: data.decision === "approve" ? "Approved — the buyer has the return instructions" : "Rejected — the buyer has been told" };
});

export const returnStepAction = adminAction(
  "orders.manage",
  z.object({ id: zUuid, step: z.enum(["in_transit", "received", "close"]), courier: zOptStr(120), trackingNumber: zOptStr(60) }),
  async ({ data, user, audit }) => {
    const step = data.step === "in_transit" ? { type: "in_transit" as const, courier: data.courier, trackingNumber: data.trackingNumber } : { type: data.step };
    await updateReturn(data.id, { userId: user.id, isStaff: true }, step);
    await audit({ action: `return.${data.step}`, entity: "return", entityId: data.id, summary: `Return ${data.step.replace("_", " ")}` });
    return { message: "Return updated" };
  },
);

export const refundReturnAction = adminAction("orders.refund", z.object({ id: zUuid, amount: zMoney }), async ({ data, user, audit }) => {
  const d = await db();
  const r = await d.query.returnRequests.findFirst({ where: eq(returnRequests.id, data.id), with: { order: true } });
  if (!r) throw new AdminError("Return not found");
  if (!(data.amount > 0)) throw new AdminError("Enter the refund amount.");
  await refundReturn(r.id, { userId: user.id, isStaff: true }, data.amount);
  await audit({ action: "return.refund", entity: "return", entityId: r.id, summary: `Refunded ${orderMoney(data.amount, r.order.currency)} for return ${r.number}` });
  return { message: `Refunded ${orderMoney(data.amount, r.order.currency)} through the original payment` };
});
