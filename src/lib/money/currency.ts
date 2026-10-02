/**
 * Currency rules.
 *
 * - Sellers price, get paid and see reports in PKR. Always.
 * - Overseas buyers (US / UK / Canada) see USD / GBP / CAD by default, chosen from
 *   their destination country, and may switch to PKR explicitly.
 * - Buyers in Pakistan (destination `PK`, the Pakistani Brands domestic service)
 *   see PKR by default. An overseas buyer sending a gift *to* Pakistan keeps
 *   their own currency: the currency follows the buyer, not the parcel.
 *
 * All amounts are integer minor units. Every currency here has 2 decimals.
 */

export const BUYER_CURRENCIES = ["USD", "GBP", "CAD", "PKR"] as const;
export type BuyerCurrency = (typeof BUYER_CURRENCIES)[number];
export type Currency = BuyerCurrency;

/** Overseas default currencies (each needs an exchange rate). PKR is the identity currency: the default only for buyers in Pakistan. */
export const DEFAULT_BUYER_CURRENCIES = ["USD", "GBP", "CAD"] as const;

export const CURRENCY_META: Record<Currency, { symbol: string; name: string; locale: string; flag: string }> = {
  USD: { symbol: "$", name: "US dollar", locale: "en-US", flag: "🇺🇸" },
  GBP: { symbol: "£", name: "British pound", locale: "en-GB", flag: "🇬🇧" },
  CAD: { symbol: "CA$", name: "Canadian dollar", locale: "en-CA", flag: "🇨🇦" },
  PKR: { symbol: "Rs", name: "Pakistani rupee", locale: "en-PK", flag: "🇵🇰" },
};

/**
 * Import destinations: the countries we export to, with courier, duty and
 * import-rule tables. Rate admin, coverage checks and the cross-border flows
 * iterate this list.
 */
export const DESTINATIONS = [
  { code: "US", name: "United States", currency: "USD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "CA", name: "Canada", currency: "CAD" },
] as const satisfies ReadonlyArray<{ code: string; name: string; currency: Currency }>;

export type DestinationCode = (typeof DESTINATIONS)[number]["code"];

/** Wahbayaan ships from Pakistan; delivery inside Pakistan is domestic (no import duty). */
export const ORIGIN_COUNTRY = "PK";
export const DOMESTIC_DESTINATION = { code: "PK", name: "Pakistan", currency: "PKR" } as const;

/** Every "Ship to" a buyer can pick: the import destinations plus Pakistan itself. */
export const BUYER_DESTINATIONS = [...DESTINATIONS, DOMESTIC_DESTINATION] as const;
export type BuyerDestinationCode = (typeof BUYER_DESTINATIONS)[number]["code"];

export function isDomestic(country: string | null | undefined) {
  return country === ORIGIN_COUNTRY;
}

export function isBuyerCurrency(value: unknown): value is BuyerCurrency {
  return typeof value === "string" && (BUYER_CURRENCIES as readonly string[]).includes(value);
}

/** An import destination (US / GB / CA). */
export function isDestination(value: unknown): value is DestinationCode {
  return typeof value === "string" && DESTINATIONS.some((d) => d.code === value);
}

/** Any destination a buyer may choose, including Pakistan. */
export function isBuyerDestination(value: unknown): value is BuyerDestinationCode {
  return typeof value === "string" && BUYER_DESTINATIONS.some((d) => d.code === value);
}

export function destinationName(code: string) {
  return BUYER_DESTINATIONS.find((d) => d.code === code)?.name ?? code;
}

/** USD / GBP / CAD for overseas destinations, PKR for Pakistan, USD when unknown. */
export function defaultCurrencyFor(country: string | null | undefined): BuyerCurrency {
  return BUYER_DESTINATIONS.find((d) => d.code === country)?.currency ?? "USD";
}

export function formatMoney(
  minor: number,
  currency: Currency,
  opts: { cents?: boolean; compact?: boolean } = {},
): string {
  const meta = CURRENCY_META[currency];
  const value = minor / 100;
  const showCents = opts.cents ?? (currency !== "PKR" && Math.abs(minor) % 100 !== 0);
  if (currency === "PKR") {
    // "Rs 45,000" reads better for Pakistani sellers than the ISO "PKR 45,000.00".
    const n = new Intl.NumberFormat("en-PK", {
      maximumFractionDigits: 0,
      notation: opts.compact ? "compact" : "standard",
    }).format(Math.round(value));
    return `Rs ${n}`;
  }
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency,
    currencyDisplay: currency === "CAD" ? "symbol" : "narrowSymbol",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
    notation: opts.compact ? "compact" : "standard",
  }).format(value);
}

export type FxQuote = {
  currency: Currency;
  /** How many PKR one unit of `currency` buys. 1 for PKR itself. */
  pkrPerUnit: number;
  source: string;
  status: "placeholder" | "manual" | "live";
};

export const PKR_IDENTITY: FxQuote = { currency: "PKR", pkrPerUnit: 1, source: "identity", status: "live" };

/** PKR minor units → buyer-currency minor units. */
export function convertFromPkr(pkrMinor: number, fx: FxQuote): number {
  if (fx.currency === "PKR") return pkrMinor;
  if (!(fx.pkrPerUnit > 0)) throw new Error(`Invalid FX rate for ${fx.currency}`);
  return Math.round(pkrMinor / fx.pkrPerUnit);
}

/** Amount in some currency → PKR minor units. */
export function convertToPkr(minor: number, fx: FxQuote): number {
  if (fx.currency === "PKR") return minor;
  return Math.round(minor * fx.pkrPerUnit);
}

/** Convert between any two currencies through PKR. */
export function convert(minor: number, from: FxQuote, to: FxQuote): number {
  if (from.currency === to.currency) return minor;
  return convertFromPkr(convertToPkr(minor, from), to);
}

export function applyBps(minor: number, bps: number) {
  return Math.round((minor * bps) / 10_000);
}
