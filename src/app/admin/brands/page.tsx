import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { createBrandAction } from "@/app/actions/admin/brands";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, TextInput } from "@/components/admin/controls";
import { DemoBadge, Empty, MiniStat, Panel, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { catalogueDisplayGate, hasRecordedPermission, PARTNERSHIP_LABEL } from "@/lib/brands/permission";
import { db } from "@/lib/db/client";
import { brands } from "@/lib/db/schema";
import { query } from "@/lib/admin/sql";
import { formatDate, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Brands" };

const SOURCE_LABEL = { shopify_json: "Products feed (products.json)", csv_feed: "CSV / feed upload", manual: "Manual entry" } as const;

export default async function AdminBrandsPage() {
  await requireStaff("brands.view");
  const d = await db();
  const [rows, counts] = await Promise.all([
    d.query.brands.findMany({ with: { source: true }, orderBy: [asc(brands.sort), asc(brands.name)] }),
    query<{ brand_id: string; total: number; published: number; drafts: number }>(sql`
      select brand_id, count(*)::int as total, count(*) filter (where status = 'published')::int as published, count(*) filter (where status = 'draft')::int as drafts
      from brand_products group by brand_id`),
  ]);
  const live = rows.filter((b) => b.isActive && catalogueDisplayGate(b).ok);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pakistani Brands"
        title="Brands"
        description="A brand's catalogue, logo and photos go live only once its permission is recorded and the partnership is authorised. Until then a brand is a private draft — buyers can still ask for its products through “Shop by link”."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Live on the storefront" value={String(live.length)} />
        <MiniStat label="Permission recorded" value={String(rows.filter((b) => hasRecordedPermission(b)).length)} hint={`of ${rows.length} brands`} />
        <MiniStat label="Sync switched on" value={String(rows.filter((b) => b.source?.syncEnabled).length)} />
        <MiniStat label="Drafts to review" value={String(counts.reduce((a, c) => a + c.drafts, 0))} href="/admin/brand-products?status=draft" />
      </div>
      <TableCard>
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Brand</Th>
                <Th>Partnership</Th>
                <Th>Permission</Th>
                <Th>Source</Th>
                <Th>Products</Th>
                <Th>Storefront</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((b) => {
                const c = counts.find((x) => x.brand_id === b.id);
                const gate = catalogueDisplayGate(b);
                return (
                  <Tr key={b.id}>
                    <Td>
                      <Link href={`/admin/brands/${b.id}`} className="font-medium text-indigo-800 hover:underline">
                        {b.name}
                      </Link>{" "}
                      <DemoBadge show={b.isDemo} />
                      <p className="text-xs text-umber-500">/{b.slug}</p>
                    </Td>
                    <Td>
                      <Badge tone={b.partnership === "authorised" ? "success" : b.partnership === "requested" ? "gold" : "neutral"}>{PARTNERSHIP_LABEL[b.partnership]}</Badge>
                    </Td>
                    <Td className="text-sm">{hasRecordedPermission(b) ? <span>Recorded {formatDate(b.permissionGrantedAt)}</span> : <Badge tone="pending">None</Badge>}</Td>
                    <Td className="text-sm">
                      {SOURCE_LABEL[b.source?.type ?? "manual"]}
                      <p className="text-xs text-umber-500">
                        Sync {b.source?.syncEnabled ? "on" : "off"}
                        {b.source?.lastSyncAt ? ` · last ${timeAgo(b.source.lastSyncAt)}` : ""}
                      </p>
                    </Td>
                    <Td className="text-sm tabular-nums">
                      {c ? `${c.published} live / ${c.total}` : "0"}
                    </Td>
                    <Td>{b.isActive && gate.ok ? <Badge tone="success">Live</Badge> : <Badge tone="neutral" title={gate.ok ? "Switched off" : gate.reason}>Private</Badge>}</Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>No brands yet.</Empty>
        )}
      </TableCard>
      <Panel title="Add a brand" description="Starts as a private draft with no permission and sync off.">
        <ActionForm action={createBrandAction} inline className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <FieldRow label="Name" htmlFor="name">
            <TextInput id="name" name="name" required />
          </FieldRow>
          <FieldRow label="Slug (optional)" htmlFor="slug">
            <TextInput id="slug" name="slug" placeholder="from the name" />
          </FieldRow>
          <SubmitButton>Create brand</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
