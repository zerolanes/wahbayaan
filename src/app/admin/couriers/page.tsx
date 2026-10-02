import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { createCourierAction, toggleCourierAction } from "@/app/actions/admin/couriers";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { CourierFields } from "@/components/admin/courier-fields";
import { Empty, Panel, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { query } from "@/lib/admin/sql";
import { db } from "@/lib/db/client";
import { couriers } from "@/lib/db/schema";

export const metadata = { title: "Couriers" };

export default async function CouriersPage() {
  await requireStaff("couriers.manage");
  const d = await db();
  const [rows, counts] = await Promise.all([
    d.select().from(couriers).orderBy(asc(couriers.name)),
    query<{ courier_id: string; total: number; active: number }>(sql`select courier_id, count(*)::int as total, count(*) filter (where status = 'active' and amount is not null)::int as active from shipping_rates where courier_id is not null group by 1`),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Delivery & payments"
        title="Couriers & rate cards"
        description="Couriers you have (or are negotiating) contracts with, for delivery within Pakistan and abroad. Rates stay pending until the contracted amount is entered; checkout uses the cheapest active rate of an active courier."
      />
      <TableCard>
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Courier</Th>
                <Th>Coverage</Th>
                <Th>Services</Th>
                <Th>Rates</Th>
                <Th>Tracking links</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((c) => {
                const n = counts.find((x) => x.courier_id === c.id);
                return (
                  <Tr key={c.id}>
                    <Td>
                      <Link href={`/admin/couriers/${c.id}`} className="font-medium text-indigo-800 hover:underline">
                        {c.name}
                      </Link>
                      {c.contractNotes ? <p className="max-w-72 truncate text-xs text-umber-500">{c.contractNotes}</p> : null}
                    </Td>
                    <Td className="text-sm">{[c.domestic && "Pakistan", c.international && "International"].filter(Boolean).join(" · ")}</Td>
                    <Td className="text-sm">{c.services.map((s) => s.label).join(", ") || "—"}</Td>
                    <Td className="text-sm tabular-nums">
                      {n ? `${n.active} active / ${n.total}` : "0"}
                    </Td>
                    <Td className="text-sm">{c.trackingUrlTemplate ? "Template set" : <Badge tone="pending">Not set</Badge>}</Td>
                    <Td>
                      <ActionButton action={toggleCourierAction} fields={{ id: c.id }} variant="ghost">
                        {c.isActive ? "Active — switch off" : "Inactive — switch on"}
                      </ActionButton>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>No couriers yet.</Empty>
        )}
      </TableCard>
      <Panel title="Add a courier">
        <ActionForm action={createCourierAction} inline className="space-y-4">
          <CourierFields />
          <SubmitButton>Add courier</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
