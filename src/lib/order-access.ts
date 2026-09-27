import "server-only";
import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Orders placed from this browser, so a guest can see their confirmation and
 * test-payment pages without an account (httpOnly cookie, last 10 orders).
 */
export const RECENT_ORDERS_COOKIE = "wb_orders";
export const REFERRAL_COOKIE = "wb_ref";

export async function recentOrderNumbers(): Promise<string[]> {
  const jar = await cookies();
  return (jar.get(RECENT_ORDERS_COOKIE)?.value ?? "").split(",").filter((n) => /^[A-Z0-9-]{4,24}$/.test(n));
}

/** Only callable from a Server Action or Route Handler. */
export async function rememberOrder(number: string) {
  const jar = await cookies();
  const list = [number, ...(await recentOrderNumbers()).filter((n) => n !== number)].slice(0, 10);
  jar.set(RECENT_ORDERS_COOKIE, list.join(","), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 90 });
}

export async function canViewOrder(order: { number: string; userId: string | null }) {
  const user = await getCurrentUser();
  if (user && order.userId === user.id) return true;
  return (await recentOrderNumbers()).includes(order.number);
}

export async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : (process.env.APP_URL ?? "http://localhost:3000");
}
