/**
 * Parcel and shipment references printed on labels and scanned at the hub.
 *
 *   WB-4F7K2Q-P2K   parcel 2 of order WB-4F7K2Q (seller → hub, or seller → buyer)
 *   WB-4F7K2Q-S1M   outbound shipment 1 of the order (hub → buyer)
 *
 * They are derived from the order number (so staff can read them) and end in
 * a check character over the whole reference, so a mistyped or mis-scanned
 * code is rejected instead of receiving the wrong parcel. Pure.
 */

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // the order-number alphabet: no 0/O/1/I

export type ReferenceKind = "P" | "S";

/** Check character: weighted sum of character codes mod 32. */
export function checkChar(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += body.charCodeAt(i) * (i + 1);
  return ALPHABET[sum % ALPHABET.length];
}

function make(orderNumber: string, kind: ReferenceKind, n: number) {
  if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error("Reference index must be 1–99");
  const body = `${orderNumber.trim().toUpperCase()}-${kind}${n}`;
  return `${body}${checkChar(body)}`;
}

export const parcelReference = (orderNumber: string, n: number) => make(orderNumber, "P", n);
export const shipmentReference = (orderNumber: string, n: number) => make(orderNumber, "S", n);

export type ParsedReference = { reference: string; orderNumber: string; kind: ReferenceKind; index: number };

/** Normalise a typed or scanned code (case, spaces) and verify its check character. Null when invalid. */
export function parseReference(input: string | null | undefined): ParsedReference | null {
  const s = String(input ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
  const m = /^([A-Z]{2,5}-[A-Z0-9]{3,12})-([PS])(\d{1,2})([2-9A-HJ-NP-Z])$/.exec(s);
  if (!m) return null;
  const body = `${m[1]}-${m[2]}${m[3]}`;
  if (checkChar(body) !== m[4]) return null;
  return { reference: s, orderNumber: m[1], kind: m[2] as ReferenceKind, index: Number(m[3]) };
}
