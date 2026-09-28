import { formatMoney, isBuyerCurrency, type Currency } from "@/lib/money/currency";

/**
 * Parse an amount typed by staff ("1,250.50", "Rs 900", "$12") into integer
 * minor units. Returns null for an empty field and NaN for anything invalid.
 */
export function parseMoneyInput(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = String(input).replace(/[\s,]/g, "").replace(/^(rs|pkr|usd|gbp|cad|ca\$|\$|£)/i, "");
  if (cleaned === "") return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  const negative = cleaned.startsWith("-");
  const [whole, frac = ""] = cleaned.replace("-", "").split(".");
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return negative ? -minor : minor;
}

/** Minor units → value for an <input> ("1250.50"; whole amounts without decimals). */
export function minorToInput(minor: number | null | undefined): string {
  if (minor == null) return "";
  const abs = Math.abs(minor);
  const s = abs % 100 === 0 ? String(abs / 100) : `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return minor < 0 ? `-${s}` : s;
}

/** A buyer-side amount with its ISO code always visible, e.g. "$1,250 USD". */
export function orderMoney(minor: number | null | undefined, currency: string): string {
  if (minor == null) return "—";
  if (!isBuyerCurrency(currency)) return `${(minor / 100).toFixed(2)} ${currency}`;
  const s = formatMoney(minor, currency as Currency);
  return currency === "PKR" ? `${s} (PKR)` : `${s} ${currency}`;
}

export function bpsToPercentString(bps: number | null | undefined): string {
  if (bps == null) return "";
  return String(+(bps / 100).toFixed(2));
}

/** "12.5" → 1250 bps; empty → null; invalid → NaN. */
export function percentToBps(input: string | null | undefined): number | null {
  if (input == null || String(input).trim() === "") return null;
  const n = Number(String(input).replace("%", "").trim());
  if (!Number.isFinite(n)) return Number.NaN;
  return Math.round(n * 100);
}

/** Sum amounts per currency. */
export function sumByCurrency<T>(rows: readonly T[], currency: (r: T) => string, amount: (r: T) => number | null | undefined) {
  const out = new Map<string, number>();
  for (const r of rows) {
    const a = amount(r);
    if (a == null) continue;
    const c = currency(r);
    out.set(c, (out.get(c) ?? 0) + a);
  }
  return [...out.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([currency, total]) => ({ currency, total }));
}
