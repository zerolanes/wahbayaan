"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { couriers, shippingRates, type CourierService } from "@/lib/db/schema";
import { adminAction, AdminError } from "@/lib/admin/action";
import { zBool, zInt, zOptInt, zOptMoney, zOptStr, zStr, zUuid } from "@/lib/admin/zod";
import { isBuyerDestination } from "@/lib/money/currency";

const fields = z.object({
  name: zStr(80),
  domestic: zBool,
  international: zBool,
  trackingUrlTemplate: zOptStr(300).refine((v) => !v || (/^https:\/\//.test(v) && v.includes("{tracking}")), "Use an https URL containing {tracking}"),
  contactNotes: zOptStr(2000),
  contractNotes: zOptStr(2000),
  /** One service level per line: "Express, 1, 2" (label, min days, max days). */
  services: zOptStr(2000),
  isActive: zBool,
});

function parseServices(text: string | null): CourierService[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [label, min, max] = l.split(",").map((s) => s.trim());
      const n = (s?: string) => (s && /^\d+$/.test(s) ? Number(s) : null);
      return { key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"), label, transitDaysMin: n(min), transitDaysMax: n(max) };
    });
}

export const createCourierAction = adminAction("couriers.manage", fields, async ({ data, audit }) => {
  if (!data.domestic && !data.international) throw new AdminError("Tick domestic, international or both.");
  const d = await db();
  const [c] = await d.insert(couriers).values({ ...data, services: parseServices(data.services) }).returning();
  await audit({ action: "courier.create", entity: "courier", entityId: c.id, summary: `Added courier ${c.name}${c.isActive ? "" : " (inactive)"}` });
  redirect(`/admin/couriers/${c.id}`);
});

export const updateCourierAction = adminAction("couriers.manage", fields.extend({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const before = await d.query.couriers.findFirst({ where: eq(couriers.id, data.id) });
  if (!before) throw new AdminError("Courier not found");
  if (!data.domestic && !data.international) throw new AdminError("Tick domestic, international or both.");
  const row = { name: data.name, domestic: data.domestic, international: data.international, trackingUrlTemplate: data.trackingUrlTemplate, contactNotes: data.contactNotes, contractNotes: data.contractNotes, services: parseServices(data.services), isActive: data.isActive };
  await d.update(couriers).set(row).where(eq(couriers.id, before.id));
  if (row.name !== before.name) await d.update(shippingRates).set({ courier: row.name }).where(eq(shippingRates.courierId, before.id));
  await audit({ action: "courier.update", entity: "courier", entityId: before.id, summary: `Edited courier ${row.name}`, data: { before, after: row } });
  return { message: "Courier saved" };
});

export const toggleCourierAction = adminAction("couriers.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const c = await d.query.couriers.findFirst({ where: eq(couriers.id, data.id) });
  if (!c) throw new AdminError("Courier not found");
  await d.update(couriers).set({ isActive: !c.isActive }).where(eq(couriers.id, c.id));
  await audit({ action: c.isActive ? "courier.deactivate" : "courier.activate", entity: "courier", entityId: c.id, summary: `${c.isActive ? "Deactivated" : "Activated"} courier ${c.name}` });
  return { message: c.isActive ? `${c.name} switched off — its rates are no longer offered` : `${c.name} switched on` };
});

/** Add a rate-card row: domestic (destination PK + zone) or international (destination country). Pending until an amount is entered. */
export const addCourierRateAction = adminAction(
  "couriers.manage",
  z.object({
    courierId: zUuid,
    destination: z.string().refine(isBuyerDestination, "Choose a destination"),
    zone: zOptStr(40),
    serviceName: zOptStr(80),
    minWeightG: zInt(0, 1_000_000),
    maxWeightG: zInt(1, 1_000_000),
    amount: zOptMoney,
    transitDaysMin: zOptInt(0, 120),
    transitDaysMax: zOptInt(0, 120),
  }),
  async ({ data, audit }) => {
    const d = await db();
    const c = await d.query.couriers.findFirst({ where: eq(couriers.id, data.courierId) });
    if (!c) throw new AdminError("Courier not found");
    if (data.maxWeightG <= data.minWeightG) throw new AdminError("The weight band must end after it starts.");
    const domestic = data.destination === "PK";
    if (domestic && !data.zone) throw new AdminError("Domestic rates need a city zone.");
    if (domestic && !c.domestic) throw new AdminError(`${c.name} isn't marked as a domestic courier.`);
    if (!domestic && !c.international) throw new AdminError(`${c.name} isn't marked as an international courier.`);
    const [r] = await d
      .insert(shippingRates)
      .values({
        courierId: c.id,
        courier: c.name,
        serviceName: data.serviceName,
        destinationCountry: data.destination,
        zone: domestic ? data.zone : null,
        minWeightG: data.minWeightG,
        maxWeightG: data.maxWeightG,
        amount: data.amount,
        currency: "PKR",
        transitDaysMin: data.transitDaysMin,
        transitDaysMax: data.transitDaysMax,
        status: data.amount != null ? "active" : "pending",
        source: "Courier rate card (Admin → Couriers)",
      })
      .returning();
    await audit({ action: "courier.rate_add", entity: "shipping_rate", entityId: r.id, summary: `${c.name}: added ${domestic ? `domestic ${data.zone}` : data.destination} ${data.minWeightG}–${data.maxWeightG} g rate (${data.amount == null ? "pending" : `Rs ${data.amount / 100}`})` });
    return { message: data.amount == null ? "Rate row added (pending until an amount is entered)" : "Rate added" };
  },
);

export const updateCourierRateAction = adminAction(
  "couriers.manage",
  z.object({ id: zUuid, amount: zOptMoney, status: z.enum(["pending", "active", "disabled"]), transitDaysMin: zOptInt(0, 120), transitDaysMax: zOptInt(0, 120) }),
  async ({ data, audit }) => {
    const d = await db();
    const r = await d.query.shippingRates.findFirst({ where: eq(shippingRates.id, data.id) });
    if (!r) throw new AdminError("Rate not found");
    if (data.status === "active" && data.amount == null) throw new AdminError("Enter the contracted amount before activating — a rate is never activated at zero or blank.");
    await d.update(shippingRates).set({ amount: data.amount, status: data.status, transitDaysMin: data.transitDaysMin, transitDaysMax: data.transitDaysMax }).where(eq(shippingRates.id, r.id));
    await audit({ action: "courier.rate_update", entity: "shipping_rate", entityId: r.id, summary: `${r.courier} ${r.destinationCountry}${r.zone ? `/${r.zone}` : ""} ${r.minWeightG}–${r.maxWeightG} g: ${data.status}${data.amount != null ? `, Rs ${data.amount / 100}` : ""}`, data: { before: r, after: data } });
    return { message: "Rate saved" };
  },
);

export const deleteCourierRateAction = adminAction("couriers.manage", z.object({ id: zUuid, courierId: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const [r] = await d.delete(shippingRates).where(and(eq(shippingRates.id, data.id), eq(shippingRates.courierId, data.courierId))).returning();
  if (!r) throw new AdminError("Rate not found");
  await audit({ action: "courier.rate_delete", entity: "shipping_rate", entityId: r.id, summary: `${r.courier}: deleted ${r.destinationCountry}${r.zone ? `/${r.zone}` : ""} ${r.minWeightG}–${r.maxWeightG} g rate` });
  return { message: "Rate deleted" };
});
