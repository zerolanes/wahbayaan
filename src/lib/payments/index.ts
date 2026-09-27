import "server-only";
import Stripe from "stripe";

/**
 * Payment providers.
 *
 * - `stripe`: live/test Stripe Checkout when STRIPE_SECRET_KEY is set.
 * - `test`:   a built-in simulator used when no provider is configured. It is
 *             labelled "Test payment — no money moves" everywhere it appears
 *             and is refused in production unless ALLOW_TEST_PAYMENTS=true.
 *
 * PayPal is listed but not implemented until an account exists.
 */
export type ProviderId = "stripe" | "test";

export type CheckoutRequest = {
  orderId: string;
  orderNumber: string;
  email: string;
  currency: string;
  amount: number; // minor units, buyer currency
  description: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutStart = { provider: ProviderId; mode: "live" | "test"; redirectUrl: string; providerRef: string };

export function activeProvider(): { id: ProviderId; mode: "live" | "test"; label: string } {
  const key = process.env.STRIPE_SECRET_KEY;
  if (key) return { id: "stripe", mode: key.startsWith("sk_live") ? "live" : "test", label: key.startsWith("sk_live") ? "Card payment (Stripe)" : "Stripe test mode" };
  return { id: "test", mode: "test", label: "Test payment — no money moves" };
}

export function testPaymentsAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_TEST_PAYMENTS === "true";
}

let stripeClient: Stripe | null = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

export async function startCheckout(req: CheckoutRequest): Promise<CheckoutStart> {
  const provider = activeProvider();
  if (provider.id === "stripe") {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer_email: req.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: req.currency.toLowerCase(),
            unit_amount: req.amount,
            product_data: { name: `Wahbayaan order ${req.orderNumber}`, description: req.description.slice(0, 500) },
          },
        },
      ],
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
      metadata: { orderId: req.orderId, orderNumber: req.orderNumber },
    });
    return { provider: "stripe", mode: provider.mode, redirectUrl: session.url!, providerRef: session.id };
  }
  if (!testPaymentsAllowed()) throw new Error("No payment provider is configured.");
  return {
    provider: "test",
    mode: "test",
    redirectUrl: `/checkout/test-payment?order=${encodeURIComponent(req.orderNumber)}`,
    providerRef: `test_${req.orderNumber}_${Date.now()}`,
  };
}

export async function refundPayment(payment: { provider: string; providerRef: string | null; amount: number }, amount: number) {
  if (payment.provider === "stripe" && payment.providerRef) {
    const session = await stripe().checkout.sessions.retrieve(payment.providerRef);
    if (typeof session.payment_intent === "string") {
      await stripe().refunds.create({ payment_intent: session.payment_intent, amount });
    }
    return { ok: true as const };
  }
  // Test payments: nothing to call.
  return { ok: true as const };
}
