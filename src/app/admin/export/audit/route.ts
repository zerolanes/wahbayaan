import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog, users } from "@/lib/db/schema";
import { auditConditions } from "@/lib/admin/audit-query";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { paramsOf, staffForRoute, stamp } from "@/lib/admin/route-auth";

export async function GET(req: Request) {
  const auth = await staffForRoute("audit.view");
  if ("error" in auth) return auth.error;
  const d = await db();
  const rows = await d
    .select({ a: auditLog, actor: users.name, actorEmail: users.email })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(auditConditions(paramsOf(req)))
    .orderBy(desc(auditLog.createdAt))
    .limit(50_000);
  const csv = toCsv(rows, [
    { header: "At", value: (r) => r.a.createdAt },
    { header: "Actor", value: (r) => (r.a.actorUserId ? (r.actor ?? "Former staff") : "System") },
    { header: "Actor email", value: (r) => r.actorEmail },
    { header: "Action", value: (r) => r.a.action },
    { header: "Entity", value: (r) => r.a.entity },
    { header: "Entity id", value: (r) => r.a.entityId },
    { header: "Summary", value: (r) => r.a.summary },
    { header: "Data", value: (r) => (r.a.data == null ? "" : JSON.stringify(r.a.data)) },
  ]);
  return csvResponse(`wahbayaan-audit-${stamp()}.csv`, csv);
}
