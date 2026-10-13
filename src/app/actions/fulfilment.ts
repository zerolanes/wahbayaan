"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { OrderError } from "@/lib/commerce/orders";
import { db } from "@/lib/db/client";
import { fulfilmentQuotes, orderItems } from "@/lib/db/schema";
import { declineFulfilmentQuote, markFulfilmentQuotePaid, payFulfilmentQuote, requestReturn } from "@/lib/fulfilment/service";
import { requestOrigin } from "@/lib/order-access";
import { activeProvider, testPaymentsAllowed } from "@/lib/payments";
import { saveUploads } from "@/lib/storage";

export type ReturnState = { ok?: boolean; message?: string; error?: string } | null;

/** Buyer approves an extra-shipping charge: pay just that amount. */
export async function approveExtraShipping(formData: FormData) {
  const user = await requireUser("/account/orders");
  const id = String(formData.get("quoteId") ?? "");
  const number = String(formData.get("order") ?? "");
  let url: string;
  try {
    url = await payFulfilmentQuote(id, user.id, await requestOrigin());
  } catch (e) {
    if (e instanceof OrderError) redirect(`/account/orders/${number}?extra=unavailable`);
    throw e;
  }
  redirect(url);
}

export async function declineExtraShipping(formData: FormData) {
  const user = await requireUser("/account/orders");
  const number = String(formData.get("order") ?? "");
  try {
    await declineFulfilmentQuote(String(formData.get("quoteId") ?? ""), user.id);
  } catch (e) {
    if (!(e instanceof OrderError)) throw e;
  }
  redirect(`/account/orders/${number}?extra=declined`);
}

/** Test simulator for the extra-shipping payment (no provider configured). */
export async function simulateExtraShippingPaid(formData: FormData) {
  if (!testPaymentsAllowed() || activeProvider().id !== "test") redirect("/");
  const user = await requireUser("/account/orders");
  const d = await db();
  const q = await d.query.fulfilmentQuotes.findFirst({ where: eq(fulfilmentQuotes.id, String(formData.get("quoteId") ?? "")), with: { order: true } });
  if (!q || q.order.userId !== user.id) redirect("/");
  await markFulfilmentQuotePaid(q.id);
  redirect(`/account/orders/${q.order.number}?extra=paid`);
}

const returnSchema = z.object({
  order: z.string().min(4),
  reason: z.enum(["damaged", "not_as_described", "wrong_item", "changed_mind", "other"]),
  description: z.string().trim().min(10, "Tell us a little about why (at least 10 characters)").max(2000),
});

export async function requestReturnAction(_prev: ReturnState, formData: FormData): Promise<ReturnState> {
  const user = await requireUser("/account/orders");
  const parsed = returnSchema.safeParse({ order: formData.get("order"), reason: formData.get("reason"), description: formData.get("description") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const ids = formData.getAll("items").map(String);
  if (!ids.length) return { error: "Choose what you'd like to return." };
  const d = await db();
  const items = [];
  for (const id of ids) {
    const it = await d.query.orderItems.findFirst({ where: eq(orderItems.id, id) });
    if (it) items.push({ orderItemId: it.id, title: it.title, qty: it.qty, vendorOrderId: it.vendorOrderId });
  }
  if (!items.length) return { error: "Choose what you'd like to return." };
  const photos = await saveUploads(
    formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 4),
    { uploadedById: user.id },
  ).catch(() => [] as string[]);
  const sellers = new Set(items.map((i) => i.vendorOrderId));
  try {
    const r = await requestReturn(parsed.data.order, user.id, {
      items: items.map(({ orderItemId, title, qty }) => ({ orderItemId, title, qty })),
      reason: parsed.data.reason,
      description: parsed.data.description,
      photos,
      vendorOrderId: sellers.size === 1 ? [...sellers][0] : null,
    });
    refresh();
    return { ok: true, message: `Return ${r.number} requested. We'll email you where to send it.` };
  } catch (e) {
    return { error: e instanceof OrderError ? e.message : "Something went wrong. Please try again." };
  }
}
