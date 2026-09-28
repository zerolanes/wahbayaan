import "server-only";
import type { SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";

/** Run raw SQL and return plain rows on both PGlite ({ rows }) and postgres-js (array) drivers. */
export async function query<T extends Record<string, unknown>>(q: SQL): Promise<T[]> {
  const d = await db();
  const r = await d.execute(q);
  return (Array.isArray(r) ? r : ((r as unknown as { rows?: T[] }).rows ?? [])) as T[];
}

export async function scalar(q: SQL): Promise<number> {
  const rows = await query<{ n: number | string | null }>(q);
  return Number(rows[0]?.n ?? 0);
}

/** Escape a user search term for ILIKE. */
export function likeTerm(q: string) {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}
