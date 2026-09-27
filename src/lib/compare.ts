/**
 * Side-by-side comparison list, stored as comma-separated product ids in the
 * `wb_compare` cookie. Pure helpers so the rules are unit-tested.
 */
export const COMPARE_COOKIE = "wb_compare";
export const COMPARE_MAX = 4;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseCompareCookie(value: string | null | undefined): string[] {
  if (!value) return [];
  const ids: string[] = [];
  for (const raw of value.split(",")) {
    const id = raw.trim().toLowerCase();
    if (UUID.test(id) && !ids.includes(id)) ids.push(id);
    if (ids.length === COMPARE_MAX) break;
  }
  return ids;
}

export function serializeCompare(ids: string[]) {
  return ids.slice(0, COMPARE_MAX).join(",");
}

export type CompareChange = { ids: string[]; added: boolean; removed: boolean; full: boolean };

/** Toggle a product in the list. A full list is left unchanged and reported as `full`. */
export function toggleCompareId(ids: string[], productId: string): CompareChange {
  const id = productId.toLowerCase();
  if (!UUID.test(id)) return { ids, added: false, removed: false, full: false };
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), added: false, removed: true, full: false };
  if (ids.length >= COMPARE_MAX) return { ids, added: false, removed: false, full: true };
  return { ids: [...ids, id], added: true, removed: false, full: false };
}

export function removeCompareId(ids: string[], productId: string) {
  return ids.filter((x) => x !== productId.toLowerCase());
}

/** True when the values in a comparison row are not all the same (ignoring case and spacing). */
export function valuesDiffer(values: (string | number | null | undefined)[]) {
  if (values.length < 2) return false;
  const norm = values.map((v) => (v == null || v === "" ? "—" : String(v).trim().toLowerCase().replace(/\s+/g, " ")));
  return norm.some((v) => v !== norm[0]);
}
