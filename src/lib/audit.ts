import "server-only";
import { db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";

/** Record a staff (or system) action. Call from every admin mutation. */
export async function audit(entry: { actorUserId: string | null; action: string; entity: string; entityId?: string | null; summary: string; data?: unknown }) {
  const d = await db();
  await d.insert(auditLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    data: (entry.data ?? null) as never,
  });
}
