import "server-only";
import { and, eq, gte, ilike, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { auditLog } from "@/lib/db/schema";
import { dateRange, str, type SearchParams } from "./params";
import { likeTerm } from "./sql";

/** URL filters for the audit log, shared by the page and its CSV export. */
export function auditConditions(params: SearchParams): SQL {
  const c: (SQL | undefined)[] = [];
  const q = str(params, "q");
  if (q) c.push(or(ilike(auditLog.summary, likeTerm(q)), ilike(auditLog.action, likeTerm(q)), ilike(auditLog.entityId, likeTerm(q))));
  const actor = str(params, "actor");
  if (actor === "system") c.push(isNull(auditLog.actorUserId));
  else if (/^[0-9a-f-]{36}$/i.test(actor)) c.push(eq(auditLog.actorUserId, actor));
  if (str(params, "entity")) c.push(eq(auditLog.entity, str(params, "entity")));
  if (str(params, "entityId")) c.push(eq(auditLog.entityId, str(params, "entityId")));
  const action = str(params, "action");
  // "fx." matches every fx.* action; a full name matches exactly.
  if (action) c.push(action.endsWith(".") ? ilike(auditLog.action, `${action.replace(/[\\%_]/g, (m) => `\\${m}`)}%`) : eq(auditLog.action, action));
  if (str(params, "from") || str(params, "to")) {
    const r = dateRange(params, 36500);
    c.push(gte(auditLog.createdAt, r.from), lt(auditLog.createdAt, r.toExclusive));
  }
  return c.length ? and(...c)! : sql`true`;
}
