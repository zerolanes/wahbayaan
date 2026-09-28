"use server";

import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { rememberOrder } from "@/lib/order-access";

export type TrackState = { error?: string; values?: { number: string; email: string } } | null;

const schema = z.object({
  number: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,24}$/, "Enter the order number from your confirmation email"),
  email: z.email("Enter the email you ordered with").transform((e) => e.toLowerCase()),
});

/**
 * Guest order lookup: the order number and the email it was placed with.
 * A match is remembered in this browser (like checkout does) so the tracking
 * page can be opened again; a miss never reveals whether the number exists.
 */
export async function trackOrderAction(_prev: TrackState, formData: FormData): Promise<TrackState> {
  const raw = { number: String(formData.get("number") ?? ""), email: String(formData.get("email") ?? "") };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details and try again.", values: raw };
  const number = parsed.data.number.startsWith("WB-") ? parsed.data.number : `WB-${parsed.data.number}`;
  const d = await db();
  const order = await d.query.orders.findFirst({
    where: and(eq(orders.number, number), eq(sql`lower(${orders.email})`, parsed.data.email)),
    columns: { number: true, userId: true },
  });
  if (!order) return { error: "We couldn't find an order with that number and email. Check your confirmation email, or contact us.", values: raw };
  const user = await getCurrentUser();
  if (user && order.userId === user.id) redirect(`/account/orders/${order.number}`);
  await rememberOrder(order.number);
  redirect(`/track/${order.number}`);
}
