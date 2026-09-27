import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";
import { markPaid } from "@/lib/commerce/orders";
import { stripe } from "@/lib/payments";

/** Stripe → Wahbayaan: marks orders paid (funds held) when Checkout completes. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return new Response("Stripe not configured", { status: 501 });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string; metadata?: { orderId?: string } | null; payment_status?: string };
    if (session.metadata?.orderId && session.payment_status === "paid") {
      await markPaid(session.metadata.orderId, session.id);
    }
  }
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as { id: string };
    const d = await db();
    await d.update(payments).set({ status: "failed" }).where(eq(payments.providerRef, session.id));
  }
  return Response.json({ received: true });
}
