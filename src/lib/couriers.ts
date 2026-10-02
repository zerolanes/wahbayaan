import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { couriers } from "@/lib/db/schema";

/** Courier names for a ship form: couriers covering the route, active ones first (Admin → Couriers). */
export async function getShippingCouriers(destinationCountry: string): Promise<string[]> {
  const d = await db();
  const rows = await d.select().from(couriers).orderBy(asc(couriers.name));
  const fits = rows.filter((c) => (destinationCountry === "PK" ? c.domestic : c.international));
  return [...fits.filter((c) => c.isActive), ...fits.filter((c) => !c.isActive)].map((c) => c.name);
}
