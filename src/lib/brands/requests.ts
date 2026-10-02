/**
 * "Shop any Pakistani brand by link": the buyer pastes product links, staff
 * check and price each item, and the buyer approves a quote. We never fetch the
 * link or show the brand's images — only the URL's domain is displayed. Pure.
 */

export type UrlCheck = { ok: true; url: string; domain: string } | { ok: false; error: string };

const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".intranet", ".lan", ".home", ".corp", ".invalid", ".test", ".example", ".onion"];

function isPrivateIPv4(host: string) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** Validates a product link: http(s) only, a public host name, no credentials. */
export function validateProductUrl(raw: string): UrlCheck {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Paste the product link from the brand's website." };
  if (text.length > 2000) return { ok: false, error: "That link is too long." };
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, error: "That doesn't look like a web link." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: "Only http and https links are accepted." };
  if (u.username || u.password) return { ok: false, error: "Links with a username or password aren't accepted." };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || !host.includes(".")) return { ok: false, error: "Use the brand's public website link." };
  if (host.startsWith("[") || host.includes(":")) return { ok: false, error: "Use the brand's website address, not an IP address." };
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return { ok: false, error: isPrivateIPv4(host) ? "That address is on a private network." : "Use the brand's website address, not an IP address." };
  if (/^\d+$/.test(host.replace(/\./g, "")) || /^0x/i.test(host)) return { ok: false, error: "Use the brand's website address, not an IP address." };
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return { ok: false, error: "Use the brand's public website link." };
  if (u.port && !["80", "443"].includes(u.port)) return { ok: false, error: "Use the brand's normal website link." };
  u.hash = "";
  return { ok: true, url: u.toString(), domain: host.replace(/^www\./, "") };
}

export type RequestItemInput = {
  url: string;
  productName: string;
  brandName: string;
  size: string;
  colour: string;
  qty: number;
  notes: string;
};

export type ParsedRequestItem = {
  url: string;
  domain: string;
  productName: string;
  brandName: string;
  size: string | null;
  colour: string | null;
  qty: number;
  notes: string | null;
};

export const MAX_REQUEST_ITEMS = 10;

/** Validate every row of a request; returns per-row errors keyed `items.<i>.<field>`. */
export function parseRequestItems(rows: RequestItemInput[]): { items: ParsedRequestItem[]; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const items: ParsedRequestItem[] = [];
  const filled = rows.filter((r) => r.url.trim() || r.productName.trim());
  if (!filled.length) errors["items.0.url"] = "Add at least one item.";
  if (filled.length > MAX_REQUEST_ITEMS) errors["items"] = `Up to ${MAX_REQUEST_ITEMS} items per request.`;
  filled.slice(0, MAX_REQUEST_ITEMS).forEach((r, i) => {
    const url = validateProductUrl(r.url);
    if (!url.ok) errors[`items.${i}.url`] = url.error;
    const name = r.productName.trim();
    if (name.length < 2) errors[`items.${i}.productName`] = "Enter the product name as shown on the brand's site.";
    const qty = Math.floor(r.qty);
    if (!(qty >= 1 && qty <= 20)) errors[`items.${i}.qty`] = "Quantity 1–20.";
    if (url.ok && name.length >= 2 && qty >= 1 && qty <= 20)
      items.push({
        url: url.url,
        domain: url.domain,
        productName: name.slice(0, 200),
        brandName: r.brandName.trim().slice(0, 80) || brandFromDomain(url.domain),
        size: r.size.trim().slice(0, 40) || null,
        colour: r.colour.trim().slice(0, 40) || null,
        qty,
        notes: r.notes.trim().slice(0, 500) || null,
      });
  });
  return { items, errors };
}

/** "pk.some-brand.com" → "Some Brand" — a starting guess staff can correct. */
export function brandFromDomain(domain: string) {
  const parts = domain.split(".").filter((p) => !["www", "shop", "pk", "store", "com", "co", "net", "org"].includes(p));
  const core = parts[0] ?? domain;
  return core
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Link-request quote is ready to send when every available item has a price and a weight. */
export function requestReadyToQuote(items: { unavailable: boolean; unitPricePkr: number | null; weightG: number | null }[]): { ok: true } | { ok: false; reason: string } {
  const live = items.filter((i) => !i.unavailable);
  if (!live.length) return { ok: false, reason: "Every item is marked unavailable — cancel the request instead." };
  if (live.some((i) => i.unitPricePkr == null || i.unitPricePkr <= 0)) return { ok: false, reason: "Enter the brand's price (PKR) for every available item." };
  if (live.some((i) => i.weightG == null || i.weightG <= 0)) return { ok: false, reason: "Enter an estimated weight for every available item so shipping can be quoted." };
  return { ok: true };
}
