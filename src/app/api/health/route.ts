import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

/** Liveness + database check for the hosting platform's health probe. */
export async function GET() {
  try {
    const d = await db();
    await d.execute(sql`select 1`);
    return Response.json({ ok: true, database: process.env.DATABASE_URL ? "postgres" : "pglite", demo: process.env.DEMO_MODE === "true" });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
