import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getFxQuote } from "@/lib/commerce/rates";
import {
  defaultCurrencyFor,
  isBuyerCurrency,
  isDestination,
  type BuyerCurrency,
  type DestinationCode,
  type FxQuote,
} from "@/lib/money/currency";

export const CURRENCY_COOKIE = "wb_currency";
export const DESTINATION_COOKIE = "wb_dest";
export const VISITOR_COOKIE = "wb_visitor";

export type BuyerContext = {
  destination: DestinationCode;
  currency: BuyerCurrency;
  /** True when the buyer picked the currency themselves (the only way to see PKR). */
  currencyChosen: boolean;
  fx: FxQuote | null;
  /** Key for carts and wishlists: `user:<id>` or `visitor:<id>`. Null before the first response sets a visitor cookie. */
  ownerKey: string | null;
  userId: string | null;
};

/**
 * Buyer-facing currency and destination for this request. Seller and admin
 * surfaces must not use this — they always work in PKR.
 */
export const getBuyerContext = cache(async (): Promise<BuyerContext> => {
  const [jar, user] = await Promise.all([cookies(), getCurrentUser()]);
  const destCookie = jar.get(DESTINATION_COOKIE)?.value;
  const destination: DestinationCode = isDestination(destCookie)
    ? destCookie
    : isDestination(user?.country)
      ? (user!.country as DestinationCode)
      : "US";
  const currencyCookie = jar.get(CURRENCY_COOKIE)?.value;
  const currencyChosen = isBuyerCurrency(currencyCookie);
  const currency: BuyerCurrency = currencyChosen ? (currencyCookie as BuyerCurrency) : defaultCurrencyFor(destination);
  const visitor = jar.get(VISITOR_COOKIE)?.value;
  const ownerKey = user ? `user:${user.id}` : visitor ? `visitor:${visitor}` : null;
  return { destination, currency, currencyChosen, fx: await getFxQuote(currency), ownerKey, userId: user?.id ?? null };
});
