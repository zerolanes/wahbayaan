"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { addresses, carts, orders, payments, referralCodes } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { loadCart } from "@/lib/commerce/cart";
import { beginPayment, markPaid, OrderError, placeOrder } from "@/lib/commerce/orders";
import { activeProvider, testPaymentsAllowed } from "@/lib/payments";
import { canViewOrder, REFERRAL_COOKIE, rememberOrder, requestOrigin } from "@/lib/order-access";

export type CheckoutState = { error?: string; fieldErrors?: Record<string, string> } | null;

const opt = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => v || null);

const schema = z.object({
  email: z.email("Please enter a valid email"),
  customerName: z.string().trim().min(2, "Please enter your name").max(120),
  addressId: z.string().optional(),
  fullName: z.string().trim().max(120).optional(),
  line1: z.string().trim().max(200).optional(),
  line2: opt,
  city: z.string().trim().max(120).optional(),
  region: opt,
  postalCode: opt,
  phone: z.string().trim().min(6, "A phone number helps the courier deliver").max(40),
  country: z.string().length(2),
  buyerNotes: z.string().trim().max(1000).optional(),
  giftMessage: z.string().trim().max(500).optional(),
  saveAddress: z.string().optional(),
});

/** Create the order from the cart, then either start payment or wait for a quote. */
export async function placeOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const parsed = schema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Please check the highlighted fields.", fieldErrors };
  }
  const f = parsed.data;
  const [ctx, user] = await Promise.all([getBuyerContext(), getCurrentUser()]);
  const d = await db();

  let address: { fullName: string; line1: string; line2: string | null; city: string; region: string | null; postalCode: string | null; country: string; phone: string | null };
  if (user && f.addressId && f.addressId !== "new") {
    const saved = await d.query.addresses.findFirst({ where: and(eq(addresses.id, f.addressId), eq(addresses.userId, user.id)) });
    if (!saved) return { error: "That saved address wasn't found." };
    address = { fullName: saved.fullName, line1: saved.line1, line2: saved.line2, city: saved.city, region: saved.region, postalCode: saved.postalCode, country: saved.country, phone: f.phone || saved.phone };
  } else {
    const missing: Record<string, string> = {};
    if (!f.fullName || f.fullName.length < 2) missing.fullName = "Who should the courier deliver to?";
    if (!f.line1) missing.line1 = "Enter the street address";
    if (!f.city) missing.city = "Enter the town or city";
    if (!f.postalCode) missing.postalCode = "Couriers need a postal code";
    if (Object.keys(missing).length) return { error: "Please complete the delivery address.", fieldErrors: missing };
    address = { fullName: f.fullName!, line1: f.line1!, line2: f.line2, city: f.city!, region: f.region, postalCode: f.postalCode, country: f.country, phone: f.phone };
  }
  if (address.country !== ctx.destination) return { error: "Your delivery address must be in the country your costs were estimated for. Change the destination in your cart." };

  // A gift message typed at checkout replaces the one saved in the cart.
  let cart = await loadCart();
  if (cart.cartId && cart.isGift && f.giftMessage !== undefined) {
    await d.update(carts).set({ giftMessage: f.giftMessage || null }).where(eq(carts.id, cart.cartId));
    cart = await loadCart();
  }

  // Referral from a /r/CODE link — never your own code.
  const jar = await cookies();
  let referralCode = jar.get(REFERRAL_COOKIE)?.value?.toUpperCase() ?? null;
  if (referralCode) {
    const code = await d.query.referralCodes.findFirst({ where: eq(referralCodes.code, referralCode) });
    if (!code || (user && code.userId === user.id)) referralCode = null;
  }

  let order;
  try {
    order = await placeOrder({
      cart,
      userId: user?.id ?? null,
      email: f.email.toLowerCase(),
      customerName: f.customerName,
      address,
      buyerNotes: f.buyerNotes || null,
      referralCode,
    });
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }
  await rememberOrder(order.number);
  if (referralCode) jar.delete(REFERRAL_COOKIE);
  if (user && f.saveAddress === "on" && (!f.addressId || f.addressId === "new")) {
    const hasAny = await d.query.addresses.findFirst({ where: eq(addresses.userId, user.id) });
    await d.insert(addresses).values({ userId: user.id, label: "Delivery", ...address, isDefault: !hasAny });
  }

  if (order.totalComplete) {
    let url: string;
    try {
      url = (await beginPayment(order.number, await requestOrigin())).redirectUrl;
    } catch (e) {
      // The order exists; the buyer can retry payment from the confirmation page.
      console.error("beginPayment failed", e);
      redirect(`/checkout/success?order=${order.number}&payment=unavailable`);
    }
    redirect(url);
  }
  redirect(`/checkout/success?order=${order.number}`);
}

/** Pay an order that's ready (complete total, or an approved quote). Owner or this browser only. */
export async function payOrder(formData: FormData) {
  const number = String(formData.get("order") ?? "");
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.number, number) });
  if (!order || !(await canViewOrder(order))) redirect("/");
  let url: string;
  try {
    url = (await beginPayment(order.number, await requestOrigin())).redirectUrl;
  } catch (e) {
    if (e instanceof OrderError) redirect(`/checkout/success?order=${order.number}&payment=unavailable`);
    throw e;
  }
  redirect(url);
}

async function testOrder(formData: FormData) {
  if (activeProvider().id !== "test" || !testPaymentsAllowed()) redirect("/");
  const number = String(formData.get("order") ?? "");
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.number, number) });
  if (!order || !(await canViewOrder(order))) redirect("/");
  const payment = await d.query.payments.findFirst({ where: and(eq(payments.orderId, order.id), eq(payments.provider, "test")), orderBy: desc(payments.createdAt) });
  return { d, order, payment };
}

/** Test simulator: behave like the provider's "payment succeeded" webhook. */
export async function simulatePaymentSuccess(formData: FormData) {
  const { order, payment } = await testOrder(formData);
  if (!["awaiting_payment", "quote_sent"].includes(order.status) || !order.totalComplete) redirect(`/checkout/success?order=${order.number}`);
  await markPaid(order.id, payment?.status === "pending" ? payment.providerRef : null);
  redirect(`/checkout/success?order=${order.number}`);
}

/** Test simulator: a declined card. The order stays unpaid and can be retried. */
export async function simulatePaymentFailure(formData: FormData) {
  const { d, order, payment } = await testOrder(formData);
  if (payment?.status === "pending") await d.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));
  redirect(`/checkout/test-payment?order=${order.number}&failed=1`);
}
