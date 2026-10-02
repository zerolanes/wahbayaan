import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { couriers, dutyRates, shippingRates } from "@/lib/db/schema";
import { getFxTable } from "@/lib/commerce/rates";
import { getSettings } from "@/lib/settings";
import { isDomestic, ORIGIN_COUNTRY } from "@/lib/money/currency";
import type { BrandQuoteInput } from "./pricing";

/** Everything computeBrandQuote needs except the items, buyer fx and city. */
export const getBrandPricingContext = cache(async (shipTo: string): Promise<Omit<BrandQuoteInput, "items" | "fx" | "city" | "shipTo">> => {
  const d = await db();
  const country = isDomestic(shipTo) ? ORIGIN_COUNTRY : shipTo;
  const [fxTable, s, ship, duty] = await Promise.all([
    getFxTable(),
    getSettings(["brand_margin", "domestic_delivery"]),
    d
      .select({ r: shippingRates, courierActive: couriers.isActive })
      .from(shippingRates)
      .leftJoin(couriers, eq(couriers.id, shippingRates.courierId))
      .where(eq(shippingRates.destinationCountry, country)),
    isDomestic(shipTo) ? Promise.resolve([]) : d.select().from(dutyRates).where(eq(dutyRates.destinationCountry, country)),
  ]);
  const rates = ship.map(({ r, courierActive }) => ({ ...r, amount: r.amount ?? null, courierActive: courierActive ?? true }));
  return {
    fxTable,
    margin: s.brand_margin,
    domestic: { setting: s.domestic_delivery, rates: isDomestic(shipTo) ? rates : [] },
    international: {
      shippingRates: isDomestic(shipTo) ? [] : rates.filter((r) => !r.zone),
      dutyRates: duty.map((r) => ({ ...r, dutyPercent: r.dutyPercent == null ? null : Number(r.dutyPercent), taxPercent: r.taxPercent == null ? null : Number(r.taxPercent) })),
    },
  };
});
