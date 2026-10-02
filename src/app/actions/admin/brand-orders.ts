"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { adminAction, AdminError } from "@/lib/admin/action";
import { parseMoneyInput } from "@/lib/admin/money";
import { zOptMoney, zOptStr, zUuid } from "@/lib/admin/zod";
import { advanceBrandFulfilment, priceBrandOrder, sendBrandQuote, type StaffItemPrice } from "@/lib/brands/orders";
import { formatMoney, type Currency } from "@/lib/money/currency";

async function brandOrder(id: string) {
  const d = await db();
  const o = await d.query.orders.findFirst({ where: eq(orders.id, id), with: { brandItems: true } });
  if (!o || o.kind !== "brand") throw new AdminError("Brand order not found");
  return o;
}

/** Staff check each item at the brand and enter its price (PKR) and an estimated weight. */
export const priceBrandItemsAction = adminAction("orders.manage", z.object({ orderId: zUuid }), async ({ data, formData, audit }) => {
  const o = await brandOrder(data.orderId);
  const items: StaffItemPrice[] = o.brandItems.map((it) => {
    const price = parseMoneyInput(String(formData.get(`price_${it.id}`) ?? ""));
    const weight = String(formData.get(`weight_${it.id}`) ?? "").trim();
    if (price != null && (Number.isNaN(price) || price <= 0)) throw new AdminError(`${it.title}: enter the brand's price in PKR, e.g. 3490.`);
    const w = weight ? Number(weight) : null;
    if (w != null && (!Number.isInteger(w) || w <= 0 || w > 70_000)) throw new AdminError(`${it.title}: weight is in grams, e.g. 700.`);
    return {
      id: it.id,
      unitPricePkr: price,
      weightG: w,
      unavailable: formData.get(`unavailable_${it.id}`) === "on",
      staffNote: String(formData.get(`note_${it.id}`) ?? "").trim().slice(0, 500) || null,
    };
  });
  const result = await priceBrandOrder(o.id, items);
  await audit({ action: "brand_order.priced", entity: "order", entityId: o.id, summary: `Priced ${items.filter((i) => i.unitPricePkr != null).length} of ${items.length} items on ${o.number}`, data: { items } });
  if (!result.ready.ok) return { message: `Saved. ${result.ready.reason}` };
  const q = result.quote!;
  const pending = q.pendingLines.map((l) => l.label).join(", ");
  return { message: `Saved. Known so far ${formatMoney(q.knownTotal, q.currency as Currency)}${pending ? ` — still pending: ${pending}` : " — complete, ready to send"}` };
});

export const sendBrandQuoteAction = adminAction(
  "orders.manage",
  z.object({ orderId: zUuid, shipping: zOptMoney, duty: zOptMoney, importTax: zOptMoney, serviceFee: zOptMoney, note: zOptStr(1000) }),
  async ({ data, user, audit }) => {
    const o = await brandOrder(data.orderId);
    const total = await sendBrandQuote(o.id, { shipping: data.shipping, duty: data.duty, importTax: data.importTax, serviceFee: data.serviceFee, note: data.note }, user.id);
    await audit({ action: "brand_order.quote", entity: "order", entityId: o.id, summary: `Sent quote for ${o.number}: ${formatMoney(total, o.currency as Currency)} ${o.currency}`, data: { overrides: data } });
    return { message: "Quote sent to the buyer" };
  },
);

export const brandFulfilmentAction = adminAction(
  "orders.manage",
  z.object({
    orderId: zUuid,
    fulfilmentId: z.union([zUuid, z.literal("all")]),
    step: z.enum(["ordered_from_brand", "received_at_wahbayaan", "quality_checked", "dispatched", "delivered"]),
    brandOrderRef: zOptStr(120),
    purchaseCost: zOptMoney,
    courier: zOptStr(120),
    trackingNumber: zOptStr(120),
    notes: zOptStr(1000),
  }),
  async ({ data, user, audit }) => {
    const o = await brandOrder(data.orderId);
    const step =
      data.step === "ordered_from_brand"
        ? { step: data.step, brandOrderRef: data.brandOrderRef, purchaseCostPkr: data.purchaseCost }
        : data.step === "dispatched"
          ? { step: data.step, courier: data.courier ?? "", trackingNumber: data.trackingNumber ?? "" }
          : data.step === "quality_checked"
            ? { step: data.step, notes: data.notes }
            : { step: data.step };
    await advanceBrandFulfilment(o.id, data.fulfilmentId, step, user.id);
    await audit({ action: `brand_order.${data.step}`, entity: "order", entityId: o.id, summary: `${o.number}: ${data.step.replaceAll("_", " ")}${data.fulfilmentId === "all" ? " (all brands)" : ""}`, data });
    return { message: "Checklist updated — the buyer has been notified" };
  },
);
