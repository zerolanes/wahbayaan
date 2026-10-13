"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { COMPARE_BRAND_COOKIE, COMPARE_COOKIE, COMPARE_MAX, compareCookieFor, parseCompareCookie, removeCompareId, serializeCompare, toggleCompareId, type CompareKind } from "@/lib/compare";

const MONTH = 60 * 60 * 24 * 30;

async function write(ids: string[], kind: CompareKind = "artisan") {
  const jar = await cookies();
  const name = compareCookieFor(kind);
  if (!ids.length) jar.delete(name);
  else jar.set(name, serializeCompare(ids), { path: "/", maxAge: MONTH, sameSite: "lax" });
}

const kindOf = (v: unknown): CompareKind => (v === "brand" ? "brand" : "artisan");

export type CompareResult = { inCompare: boolean; count: number; error?: string };

export async function toggleCompare(productId: string, kind: CompareKind = "artisan"): Promise<CompareResult> {
  const jar = await cookies();
  const k = kindOf(kind);
  const change = toggleCompareId(parseCompareCookie(jar.get(compareCookieFor(k))?.value), productId);
  if (change.full) return { inCompare: false, count: change.ids.length, error: `You can compare up to ${COMPARE_MAX} pieces — remove one first.` };
  await write(change.ids, k);
  refresh();
  return { inCompare: change.added, count: change.ids.length };
}

export async function removeFromCompare(formData: FormData) {
  const jar = await cookies();
  const k = kindOf(formData.get("kind"));
  await write(removeCompareId(parseCompareCookie(jar.get(compareCookieFor(k))?.value), String(formData.get("productId") ?? "")), k);
  refresh();
}

export async function clearCompare() {
  const jar = await cookies();
  jar.delete(COMPARE_COOKIE);
  jar.delete(COMPARE_BRAND_COOKIE);
  refresh();
}
