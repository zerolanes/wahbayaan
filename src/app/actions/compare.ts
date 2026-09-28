"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { COMPARE_COOKIE, COMPARE_MAX, parseCompareCookie, removeCompareId, serializeCompare, toggleCompareId } from "@/lib/compare";

const MONTH = 60 * 60 * 24 * 30;

async function write(ids: string[]) {
  const jar = await cookies();
  if (!ids.length) jar.delete(COMPARE_COOKIE);
  else jar.set(COMPARE_COOKIE, serializeCompare(ids), { path: "/", maxAge: MONTH, sameSite: "lax" });
}

export type CompareResult = { inCompare: boolean; count: number; error?: string };

export async function toggleCompare(productId: string): Promise<CompareResult> {
  const jar = await cookies();
  const change = toggleCompareId(parseCompareCookie(jar.get(COMPARE_COOKIE)?.value), productId);
  if (change.full) return { inCompare: false, count: change.ids.length, error: `You can compare up to ${COMPARE_MAX} pieces — remove one first.` };
  await write(change.ids);
  refresh();
  return { inCompare: change.added, count: change.ids.length };
}

export async function removeFromCompare(formData: FormData) {
  const jar = await cookies();
  await write(removeCompareId(parseCompareCookie(jar.get(COMPARE_COOKIE)?.value), String(formData.get("productId") ?? "")));
  refresh();
}

export async function clearCompare() {
  await write([]);
  refresh();
}
