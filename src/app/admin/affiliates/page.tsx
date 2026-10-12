import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { createAffiliateProgrammeAction } from "@/app/actions/admin/affiliates";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { AffiliateFields } from "@/components/admin/affiliate-fields";
import { DemoBadge, Empty, Panel, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { can, requireStaff } from "@/lib/auth/session";
import { affiliateDisplayGate } from "@/lib/affiliate";
import { query } from "@/lib/admin/sql";
import { db } from "@/lib/db/client";
import { affiliateProgrammes } from "@/lib/db/schema";
import { timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Affiliate programmes" };

export default async function AffiliatesPage() {
  const user = await requireStaff("brands.view");
  const d = await db();
  const [rows, counts] = await Promise.all([
    d.select().from(affiliateProgrammes).orderBy(asc(affiliateProgrammes.name)),
    query<{ programme_id: string; total: number; shown: number }>(sql`select programme_id, count(*)::int as total, count(*) filter (where not is_hidden)::int as shown from affiliate_products group by 1`),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pakistani Brands"
        title="Affiliate programmes"
        description="Outbound “Shop at …” partner links. Feed products and images appear only after you record that the programme's terms allow it, and only while the programme is active. They open the tracking link and are never added to the Wahbayaan bag."
      />
      <TableCard>
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Programme</Th>
                <Th>Network</Th>
                <Th>Status</Th>
                <Th>Feed display</Th>
                <Th>Products</Th>
                <Th>Last import</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((p) => {
                const gate = affiliateDisplayGate(p);
                const n = counts.find((c) => c.programme_id === p.id);
                return (
                  <Tr key={p.id}>
                    <Td>
                      <Link href={`/admin/affiliates/${p.id}`} className="font-medium text-indigo-800 hover:underline">
                        {p.name}
                      </Link>{" "}
                      <DemoBadge show={p.isDemo} />
                      <p className="text-xs text-umber-500">Shop at {p.brandName}</p>
                    </Td>
                    <Td className="text-sm">{p.network ?? "—"}</Td>
                    <Td className="text-sm capitalize">{p.status}</Td>
                    <Td>{gate.ok ? <Badge tone="success">Live</Badge> : <Badge tone="pending" title={gate.reason}>{p.displayAllowed ? "Not active" : "Not permitted"}</Badge>}</Td>
                    <Td className="text-sm tabular-nums">{n ? `${n.shown} / ${n.total}` : "0"}</Td>
                    <Td className="text-xs text-umber-500">{p.lastImportAt ? timeAgo(p.lastImportAt) : "—"}</Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>No programmes yet.</Empty>
        )}
      </TableCard>
      {can(user, "brands.manage") ? (
        <Panel title="Add a programme" description="Enter the details from the programme's own dashboard. CSV feeds (upload or URL) and manual entry only.">
          <ActionForm action={createAffiliateProgrammeAction} inline className="space-y-3">
            <AffiliateFields />
            <SubmitButton>Add programme</SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}
    </div>
  );
}
