import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { couriers, dutyRates, fxRates, importRules, shippingRates } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { isDomestic, type Currency, type FxQuote } from "@/lib/money/currency";
import type { GiftWrapSetting, HandlingFeeSetting, LcDutyRate, LcShippingRate } from "./landed-cost";

export type FxTable = Partial<Record<string, FxQuote>>;

/** All stored exchange rates, with the configured FX markup applied. */
export const getFxTable = cache(async (): Promise<FxTable> => {
  const d = await db();
  const [rows, s] = await Promise.all([d.select().from(fxRates), getSettings(["fx"])]);
  const markup = s.fx.markupBps ?? 0;
  const table: FxTable = { PKR: { currency: "PKR", pkrPerUnit: 1, source: "identity", status: "live" } };
  for (const r of rows) {
    const raw = Number(r.pkrPerUnit);
    if (!(raw > 0)) continue;
    // A markup means the buyer gets fewer PKR per unit of their currency.
    table[r.currency] = {
      currency: r.currency as Currency,
      pkrPerUnit: raw * (1 - markup / 10_000),
      source: r.source,
      status: r.status,
    };
  }
  return table;
});

export async function getFxQuote(currency: Currency): Promise<FxQuote | null> {
  return (await getFxTable())[currency] ?? null;
}

export type RateContext = {
  fxTable: FxTable;
  shippingRates: LcShippingRate[];
  dutyRates: LcDutyRate[];
  handling: HandlingFeeSetting;
  giftWrap: GiftWrapSetting;
};

export const getRateContext = cache(async (destination: string): Promise<RateContext> => {
  const d = await db();
  const [fxTable, ship, duty, s] = await Promise.all([
    getFxTable(),
    d
      .select({ r: shippingRates, courierActive: couriers.isActive })
      .from(shippingRates)
      .leftJoin(couriers, eq(couriers.id, shippingRates.courierId))
      .where(eq(shippingRates.destinationCountry, destination)),
    d.select().from(dutyRates).where(eq(dutyRates.destinationCountry, destination)),
    getSettings(["handling_fee", "gift_wrap"]),
  ]);
  return {
    fxTable,
    // Rates of a courier switched off in Admin → Couriers are never offered.
    // Zoned domestic rates need a delivery city, so cart estimates leave them out (staff quote instead).
    shippingRates: ship.filter((x) => x.courierActive !== false && !x.r.zone).map(({ r }) => ({ ...r, amount: r.amount ?? null })),
    dutyRates: duty.map((r) => ({
      ...r,
      dutyPercent: r.dutyPercent == null ? null : Number(r.dutyPercent),
      taxPercent: r.taxPercent == null ? null : Number(r.taxPercent),
    })),
    handling: s.handling_fee,
    giftWrap: s.gift_wrap,
  };
});

export type ImportNotice = {
  level: "info" | "warning" | "restricted" | "prohibited" | "not_reviewed";
  message: string;
};

/** Active import rules for a destination + category; "not reviewed" when none exist yet. */
export async function getImportNotices(destination: string, categoryId: string): Promise<ImportNotice[]> {
  if (isDomestic(destination)) return [{ level: "info", message: "Delivered within Pakistan — no import duty or customs." }];
  const d = await db();
  const rules = await d.select().from(importRules).where(eq(importRules.destinationCountry, destination));
  const active = rules.filter((r) => r.status === "active" && (r.categoryId === categoryId || r.categoryId == null));
  if (active.length) return active.map((r) => ({ level: r.level, message: r.message }));
  return [
    {
      level: "not_reviewed",
      message: "Import rules for this craft in your country haven't been reviewed by our team yet. We'll confirm before your order ships.",
    },
  ];
}
