import Link from "next/link";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { EditRow } from "@/components/admin/edit-row";
import { AuditData } from "@/components/admin/json-diff";
import { Empty, ExportLink, FilterBar, FilterDate, FilterSelect, MiniStat, TableCard } from "@/components/admin/ui";
import { PageHeader, Pagination } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { auditLog, disputes, orders, users } from "@/lib/db/schema";
import { auditConditions } from "@/lib/admin/audit-query";
import { entityHref } from "@/lib/admin/entities";
import { humanize } from "@/lib/admin/labels";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Audit log" };

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  await requireStaff("audit.view");
  const params = await props.searchParams;
  const page = pageOf(params);
  const where = auditConditions(params);
  const d = await db();
  const dayAgo = new Date(Date.now() - 86_400_000);
  const [rows, [{ n }], entities, prefixes, actors, [stats]] = await Promise.all([
    d
      .select({ a: auditLog, actor: users.name, actorEmail: users.email })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    d.select({ n: sql<number>`count(*)::int` }).from(auditLog).where(where),
    d.selectDistinct({ entity: auditLog.entity }).from(auditLog).orderBy(asc(auditLog.entity)),
    d.selectDistinct({ p: sql<string>`split_part(${auditLog.action}, '.', 1)` }).from(auditLog).orderBy(sql`1`),
    d.selectDistinct({ id: users.id, name: users.name }).from(auditLog).innerJoin(users, eq(users.id, auditLog.actorUserId)).orderBy(asc(users.name)),
    d
      .select({
        total: sql<number>`count(*)::int`,
        today: sql<number>`count(*) filter (where ${auditLog.createdAt} >= ${dayAgo})::int`,
        system: sql<number>`count(*) filter (where ${auditLog.actorUserId} is null)::int`,
        people: sql<number>`count(distinct ${auditLog.actorUserId}) filter (where ${auditLog.createdAt} >= ${dayAgo})::int`,
      })
      .from(auditLog),
  ]);
  // Orders and disputes link by number, so look those up for the rows on this page.
  const idsOf = (entity: string) => rows.filter((r) => r.a.entity === entity && r.a.entityId && /^[0-9a-f-]{36}$/i.test(r.a.entityId)).map((r) => r.a.entityId!);
  const [orderNums, disputeNums] = await Promise.all([
    idsOf("order").length ? d.select({ id: orders.id, number: orders.number }).from(orders).where(inArray(orders.id, idsOf("order"))) : [],
    idsOf("dispute").length ? d.select({ id: disputes.id, number: disputes.number }).from(disputes).where(inArray(disputes.id, idsOf("dispute"))) : [],
  ]);
  const hrefFor = (entity: string, id: string | null) => entityHref(entity, id, { number: [...orderNums, ...disputeNums].find((x) => x.id === id)?.number ?? null });
  const exportHref = hrefWith("/admin/export/audit", params, {});
  const filtered = str(params, "entityId") || str(params, "entity") || str(params, "actor") || str(params, "action") || str(params, "q") || str(params, "from") || str(params, "to");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="System" title="Audit log" description="Every staff and system change, newest first. Open an entry to see exactly what changed." actions={<ExportLink href={exportHref} />} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Entries" value={String(stats?.total ?? 0)} hint={filtered ? `${n} match the filters` : "All time"} />
        <MiniStat label="Last 24 hours" value={String(stats?.today ?? 0)} href={hrefWith("/admin/audit", {}, { from: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) })} />
        <MiniStat label="Staff active (24 h)" value={String(stats?.people ?? 0)} />
        <MiniStat label="System / scheduled" value={String(stats?.system ?? 0)} hint="Cron jobs and automatic changes" href={hrefWith("/admin/audit", {}, { actor: "system" })} />
      </div>

      <FilterBar action="/admin/audit" q={str(params, "q")} placeholder="Summary, action or record id">
        {str(params, "entityId") ? <input type="hidden" name="entityId" value={str(params, "entityId")} /> : null}
        <FilterSelect name="actor" label="Actor" value={str(params, "actor")} options={[{ value: "system", label: "System" }, ...actors.map((a) => ({ value: a.id, label: a.name }))]} />
        <FilterSelect name="entity" label="Entity" value={str(params, "entity")} options={entities.map((e) => ({ value: e.entity, label: humanize(e.entity) }))} />
        <FilterSelect name="action" label="Action" value={str(params, "action")} options={prefixes.filter((p) => p.p).map((p) => ({ value: `${p.p}.`, label: `${p.p}.*` }))} />
        <FilterDate name="from" label="From" value={str(params, "from")} />
        <FilterDate name="to" label="To" value={str(params, "to")} />
      </FilterBar>

      {str(params, "entityId") ? (
        <p className="text-sm text-umber-600">
          Showing one record: <code>{str(params, "entity")}</code> <code>{str(params, "entityId")}</code> ·{" "}
          <Link href={hrefWith("/admin/audit", params, { entityId: null })} className="underline">
            show all {str(params, "entity") ? humanize(str(params, "entity")).toLowerCase() : ""} entries
          </Link>
        </p>
      ) : null}

      <TableCard
        toolbar={
          <p className="text-sm text-umber-600">
            {n} entr{n === 1 ? "y" : "ies"}
          </p>
        }
        footer={<Pagination page={page} pageCount={pageCount(Number(n))} hrefFor={(p) => hrefWith("/admin/audit", params, { page: p })} />}
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Record</Th>
                <Th>Summary</Th>
                <Th />
              </tr>
            </THead>
            <TBody>
              {rows.map(({ a, actor, actorEmail }) => {
                const href = hrefFor(a.entity, a.entityId);
                return (
                  <EditRow
                    key={a.id}
                    colSpan={5}
                    label="Details"
                    cells={
                      <>
                        <Td className="text-xs whitespace-nowrap text-umber-600" title={formatDateTime(a.createdAt)}>
                          {formatDateTime(a.createdAt)}
                          <p className="text-umber-400">{timeAgo(a.createdAt)}</p>
                        </Td>
                        <Td className="whitespace-nowrap">
                          {a.actorUserId ? (
                            <Link href={hrefWith("/admin/audit", params, { actor: a.actorUserId })} className="text-umber-900 hover:underline" title={actorEmail ?? undefined}>
                              {actor ?? "Former staff"}
                            </Link>
                          ) : (
                            <span className="text-umber-500">System</span>
                          )}
                        </Td>
                        <Td>
                          <code className="text-xs whitespace-nowrap text-umber-700">{a.action}</code>
                        </Td>
                        <Td className="text-xs whitespace-nowrap">
                          <Link href={hrefWith("/admin/audit", {}, { entity: a.entity })} className="text-umber-600 hover:underline">
                            {humanize(a.entity)}
                          </Link>
                          {a.entityId ? (
                            <p>
                              {href ? (
                                <Link href={href} className="font-medium text-umber-900 hover:underline">
                                  Open ↗
                                </Link>
                              ) : null}{" "}
                              <Link href={hrefWith("/admin/audit", {}, { entity: a.entity, entityId: a.entityId })} className="text-umber-400 hover:underline" title="All entries for this record">
                                {a.entityId.length > 12 ? `${a.entityId.slice(0, 8)}…` : a.entityId}
                              </Link>
                            </p>
                          ) : null}
                        </Td>
                        <Td className="max-w-xl text-umber-800">{a.summary}</Td>
                      </>
                    }
                    editor={
                      <div className="max-w-4xl space-y-2">
                        <p className="text-xs text-umber-500">
                          Entry <code>{a.id}</code> · {formatDateTime(a.createdAt)} · {actor ?? "System"}
                          {a.entityId ? (
                            <>
                              {" "}
                              · record <code>{a.entityId}</code>
                            </>
                          ) : null}
                        </p>
                        <AuditData data={a.data} />
                      </div>
                    }
                  />
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>{filtered ? "No audit entries match these filters." : "Nothing has been recorded yet. Staff changes will appear here."}</Empty>
        )}
      </TableCard>
    </div>
  );
}
