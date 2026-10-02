import "server-only";
import { getSetting } from "@/lib/settings";
import { testPaymentsAllowed } from "./index";
import { availableMethods, type Market } from "./methods";

/** Checkout payment options for a buyer currency (PKR → domestic market, otherwise international). */
export async function paymentOptionsFor(currency: string) {
  const market: Market = currency === "PKR" ? "domestic" : "international";
  const setting = await getSetting("payment_methods");
  return availableMethods(setting, market, process.env, testPaymentsAllowed()).map((m) => ({
    id: m.id,
    label: m.label,
    available: m.available,
    note: m.note,
    test: m.status === "test" || m.status === "sandbox",
  }));
}
