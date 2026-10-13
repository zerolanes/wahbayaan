/**
 * Fulfilment seed data.
 *
 * - Base: the domestic couriers the owner named (TCS, Leopards, M&P, PostEx,
 *   Trax) as INACTIVE drafts with no rates — "pending contract", booked
 *   manually until an integration exists. No hub is created: the owner hasn't
 *   chosen a site.
 * - Demo: ONE clearly fictional hub ("Demo Hub (Lahore)", isDemo, address
 *   placeholders) — created switched OFF so international orders keep shipping
 *   direct until someone activates it in Admin → Hubs — and a fictional
 *   "Sandbox Courier (demo)" whose bookings are simulated.
 */
import { eq } from "drizzle-orm";
import type { Db } from "../src/lib/db/connect";
import * as t from "../src/lib/db/schema";
import { DEFAULT_FULFILMENT, type FulfilmentSetting } from "../src/lib/fulfilment/settings";

const DOMESTIC = ["TCS", "Leopards Courier", "M&P", "PostEx", "Trax"];
export const DEMO_HUB_NAME = "Demo Hub (Lahore)";
export const SANDBOX_COURIER = "Sandbox Courier (demo)";

export async function seedFulfilmentBase(db: Db) {
  for (const name of DOMESTIC) {
    const existing = await db.query.couriers.findFirst({ where: eq(t.couriers.name, name) });
    if (existing) continue;
    await db.insert(t.couriers).values({
      name,
      domestic: true,
      international: false,
      isActive: false,
      contractNotes: "Pending contract — no rates until the negotiated rate card is entered. Booked manually (tracking number typed) until an API integration is built.",
    });
  }
}

export async function seedFulfilmentDemo(db: Db) {
  if (!(await db.query.hubs.findFirst({ where: eq(t.hubs.name, DEMO_HUB_NAME) })))
    await db.insert(t.hubs).values({
      name: DEMO_HUB_NAME,
      type: "origin",
      city: "Lahore",
      country: "PK",
      address: { line1: "[Add: street address]", line2: null, city: "Lahore", region: "Punjab", postalCode: "[Add: postal code]", country: "PK" },
      contactName: "[Add: hub manager]",
      contactPhone: null,
      receivingHours: "[Add: receiving hours]",
      cutoffTime: "15:00",
      handlingDays: 2,
      notes: "FICTIONAL demo hub for trying the consolidation flow. Not a real address. Switch on in Admin → Hubs to route international orders through it.",
      isActive: false,
      isDemo: true,
    });

  let courier = await db.query.couriers.findFirst({ where: eq(t.couriers.name, SANDBOX_COURIER) });
  if (!courier)
    [courier] = await db
      .insert(t.couriers)
      .values({
        name: SANDBOX_COURIER,
        domestic: true,
        international: true,
        isActive: true,
        services: [{ key: "standard", label: "Standard (simulated)", transitDaysMin: null, transitDaysMax: null }],
        contractNotes: "FICTIONAL demo courier — bookings are simulated by the sandbox adapter (tracking numbers start with SBX). Not a real company; no rates.",
      })
      .returning();
  const row = await db.query.settings.findFirst({ where: eq(t.settings.key, "fulfilment") });
  const cur = { ...DEFAULT_FULFILMENT, ...((row?.value as Partial<FulfilmentSetting>) ?? {}) };
  if (!cur.courierAdapters[courier.id]) {
    const value = { ...cur, courierAdapters: { ...cur.courierAdapters, [courier.id]: "sandbox" } };
    await db.insert(t.settings).values({ key: "fulfilment", value }).onConflictDoUpdate({ target: t.settings.key, set: { value } });
  }
}
