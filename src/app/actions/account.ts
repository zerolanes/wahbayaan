"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { addresses, conversations, customRequests, disputes, messages, notifications, orders, users, vendors } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { addDisputeMessage, cancelOrder, confirmDelivery, openDispute, OrderError } from "@/lib/commerce/orders";
import { isDestination } from "@/lib/money/currency";
import { saveUploads } from "@/lib/storage";

export type AccountState = { ok?: boolean; error?: string; message?: string } | null;

async function ownOrder(number: string, userId: string) {
  const d = await db();
  return d.query.orders.findFirst({ where: and(eq(orders.number, number), eq(orders.userId, userId)) });
}

// ── Orders ──────────────────────────────────────────────────────────────────

export async function confirmDeliveryAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const number = String(formData.get("order") ?? "");
  const user = await requireUser(`/account/orders/${number}`);
  try {
    await confirmDelivery(number, user.id);
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }
  refresh();
  return { ok: true, message: "Thank you — the artisan has been paid. Enjoy your piece." };
}

const caseSchema = z.object({
  order: z.string().min(3),
  reason: z.enum(["damaged", "not_as_described", "not_received", "wrong_item", "other"], { message: "Choose what went wrong" }),
  description: z.string().trim().min(20, "Please describe what happened (at least 20 characters)").max(4000),
  desiredOutcome: z.string().trim().max(200).optional(),
  vendorOrderId: z.string().optional(),
});

export async function openCaseAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const parsed = caseSchema.safeParse({
    order: formData.get("order"),
    reason: formData.get("reason"),
    description: formData.get("description"),
    desiredOutcome: formData.get("desiredOutcome") || undefined,
    vendorOrderId: formData.get("vendorOrderId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await requireUser(`/account/orders/${parsed.data.order}`);
  const order = await ownOrder(parsed.data.order, user.id);
  if (!order) return { error: "Order not found." };
  const files = formData.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 8) return { error: "Please attach up to 8 photos." };
  let evidenceUrls: string[] = [];
  try {
    evidenceUrls = await saveUploads(files, { uploadedById: user.id });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't upload those photos." };
  }
  let number: string;
  try {
    const d = await db();
    const vo = parsed.data.vendorOrderId ? (await d.query.orders.findFirst({ where: eq(orders.id, order.id), with: { vendorOrders: true } }))?.vendorOrders.find((v) => v.id === parsed.data.vendorOrderId) : null;
    number = await openDispute(order.number, user.id, {
      reason: parsed.data.reason,
      description: parsed.data.description,
      desiredOutcome: parsed.data.desiredOutcome,
      evidenceUrls,
      vendorOrderId: vo?.id ?? null,
    });
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }
  redirect(`/account/disputes/${number}`);
}

export async function cancelOrderAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const number = String(formData.get("order") ?? "");
  const user = await requireUser(`/account/orders/${number}`);
  const order = await ownOrder(number, user.id);
  if (!order) return { error: "Order not found." };
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || "Cancelled by the buyer";
  try {
    await cancelOrder(order.id, { userId: user.id, reason });
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }
  refresh();
  return { ok: true, message: order.paymentStatus === "paid" ? "Cancelled — your refund is on its way to your original payment method." : "Cancelled. Nothing was charged." };
}

// ── Cases (disputes) ────────────────────────────────────────────────────────

export async function addCaseMessageAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const number = String(formData.get("case") ?? "");
  const user = await requireUser(`/account/disputes/${number}`);
  const d = await db();
  const dispute = await d.query.disputes.findFirst({ where: and(eq(disputes.number, number), eq(disputes.userId, user.id)) });
  if (!dispute) return { error: "Case not found." };
  if (["resolved", "closed"].includes(dispute.status)) return { error: "This case is closed. Contact us if you need to reopen it." };
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  let urls: string[] = [];
  try {
    urls = await saveUploads(files.slice(0, 6), { uploadedById: user.id });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't upload those photos." };
  }
  try {
    await addDisputeMessage(dispute.id, { userId: user.id, role: "buyer" }, [body, ...urls.map((u) => `Photo: ${u}`)].filter(Boolean).join("\n"));
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }
  if (urls.length) await d.update(disputes).set({ evidenceUrls: [...dispute.evidenceUrls, ...urls] }).where(eq(disputes.id, dispute.id));
  refresh();
  return { ok: true };
}

// ── Messages ────────────────────────────────────────────────────────────────

export async function sendMessageAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const id = String(formData.get("conversationId") ?? "");
  const user = await requireUser(`/account/messages/${id}`);
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write a message first." };
  if (body.length > 4000) return { error: "That message is too long." };
  const d = await db();
  const conv = await d.query.conversations.findFirst({ where: and(eq(conversations.id, id), eq(conversations.buyerId, user.id)), with: { vendor: true } });
  if (!conv) return { error: "Conversation not found." };
  await d.insert(messages).values({ conversationId: conv.id, senderUserId: user.id, body });
  await d.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conv.id));
  await d.insert(notifications).values({ userId: conv.vendor.userId, kind: "message", title: `New message from ${user.name}`, body: body.slice(0, 140), link: "/seller/messages" });
  refresh();
  return { ok: true };
}

// ── Commissions ─────────────────────────────────────────────────────────────

export async function respondToQuoteAction(formData: FormData) {
  const number = String(formData.get("request") ?? "");
  const decision = formData.get("decision") === "accept" ? "accepted" : "declined";
  const user = await requireUser("/account/requests");
  const d = await db();
  const req = await d.query.customRequests.findFirst({ where: and(eq(customRequests.number, number), eq(customRequests.userId, user.id)) });
  if (!req || req.status !== "quoted") return;
  await d.update(customRequests).set({ status: decision }).where(eq(customRequests.id, req.id));
  if (req.vendorId) {
    const vendor = await d.query.vendors.findFirst({ where: eq(vendors.id, req.vendorId) });
    if (vendor)
      await d.insert(notifications).values({
        userId: vendor.userId,
        kind: "custom_request",
        title: decision === "accepted" ? `Quote accepted for ${req.number}` : `Quote declined for ${req.number}`,
        link: "/seller/requests",
      });
  }
  refresh();
}

// ── Addresses ───────────────────────────────────────────────────────────────

const addressSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().max(40).optional(),
  fullName: z.string().trim().min(2, "Enter the recipient's name").max(120),
  line1: z.string().trim().min(3, "Enter the street address").max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, "Enter the town or city").max(120),
  region: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().min(2, "Enter the postal code").max(20),
  country: z.string().refine(isDestination, "We ship to the US, UK and Canada"),
  phone: z.string().trim().max(40).optional(),
  isDefault: z.string().optional(),
});

export async function saveAddressAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser("/account/addresses");
  const parsed = addressSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v !== "")));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, isDefault, ...a } = parsed.data;
  const d = await db();
  const values = { ...a, label: a.label || null, line2: a.line2 || null, region: a.region || null, phone: a.phone || null };
  const existingCount = (await d.select({ n: sql<number>`count(*)::int` }).from(addresses).where(eq(addresses.userId, user.id)))[0]?.n ?? 0;
  const makeDefault = isDefault === "on" || existingCount === 0;
  if (makeDefault) await d.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
  if (id) {
    const own = await d.query.addresses.findFirst({ where: and(eq(addresses.id, id), eq(addresses.userId, user.id)) });
    if (!own) return { error: "Address not found." };
    await d.update(addresses).set({ ...values, ...(makeDefault ? { isDefault: true } : {}) }).where(eq(addresses.id, id));
  } else {
    await d.insert(addresses).values({ ...values, userId: user.id, isDefault: makeDefault });
  }
  refresh();
  return { ok: true, message: id ? "Address updated." : "Address saved." };
}

export async function deleteAddressAction(formData: FormData) {
  const user = await requireUser("/account/addresses");
  const d = await db();
  const id = String(formData.get("id") ?? "");
  const own = await d.query.addresses.findFirst({ where: and(eq(addresses.id, id), eq(addresses.userId, user.id)) });
  if (!own) return;
  await d.delete(addresses).where(eq(addresses.id, id));
  if (own.isDefault) {
    const next = await d.query.addresses.findFirst({ where: eq(addresses.userId, user.id) });
    if (next) await d.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
  }
  refresh();
}

export async function setDefaultAddressAction(formData: FormData) {
  const user = await requireUser("/account/addresses");
  const d = await db();
  const id = String(formData.get("id") ?? "");
  const own = await d.query.addresses.findFirst({ where: and(eq(addresses.id, id), eq(addresses.userId, user.id)) });
  if (!own) return;
  await d.update(addresses).set({ isDefault: false }).where(and(eq(addresses.userId, user.id), ne(addresses.id, id)));
  await d.update(addresses).set({ isDefault: true }).where(eq(addresses.id, id));
  refresh();
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function updateProfileAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser("/account/settings");
  const parsed = z
    .object({ name: z.string().trim().min(2, "Please enter your name").max(80), country: z.string().optional(), marketing: z.string().optional() })
    .safeParse({ name: formData.get("name"), country: formData.get("country") ?? undefined, marketing: formData.get("marketing") ?? undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = await db();
  await d
    .update(users)
    .set({ name: parsed.data.name, country: isDestination(parsed.data.country) ? parsed.data.country : null, marketingOptIn: parsed.data.marketing === "on" })
    .where(eq(users.id, user.id));
  refresh();
  return { ok: true, message: "Saved." };
}

export async function changePasswordAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser("/account/settings");
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next.length < 8) return { error: "Use at least 8 characters for your new password." };
  if (next !== confirm) return { error: "The new passwords don't match." };
  const d = await db();
  const row = await d.query.users.findFirst({ where: eq(users.id, user.id) });
  if (!row || !(await verifyPassword(current, row.passwordHash))) return { error: "Your current password isn't right." };
  await d.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  return { ok: true, message: "Password changed." };
}
