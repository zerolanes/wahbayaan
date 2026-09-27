import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { ArrowDown, ArrowUp } from "lucide-react";
import { createCollectionAction, moveCollectionAction } from "@/app/actions/admin/collections";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { SelectInput, TextInput } from "@/components/admin/controls";
import { DemoBadge, Empty, TableCard, Thumb } from "@/components/admin/ui";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { collections } from "@/lib/db/schema";
import { query } from "@/lib/admin/sql";

export const metadata = { title: "Collections & bundles" };

export default async function CollectionsPage() {
  await requireStaff("content.manage");
  const d = await db();
  const [rows, counts] = await Promise.all([
    d.select().from(collections).orderBy(asc(collections.sort), asc(collections.title)),
    query<{ collection_id: string; n: number; active: number }>(sql`
      select cp.collection_id, count(*)::int as n, count(*) filter (where p.status = 'active')::int as active
      from collection_products cp join products p on p.id = cp.product_id group by cp.collection_id`),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Marketplace" title="Collections & bundles" description="Curated edits for the storefront. Bundles give a discount when every piece is bought together." />
      <TableCard
        toolbar={
          <ActionForm action={createCollectionAction} className="flex flex-wrap items-center gap-2">
            <TextInput name="title" placeholder="New collection title" required className="w-64" aria-label="Title" />
            <SelectInput name="kind" defaultValue="collection" className="w-36" aria-label="Kind">
              <option value="collection">Collection</option>
              <option value="bundle">Bundle</option>
            </SelectInput>
            <SubmitButton variant="primary">Create</SubmitButton>
          </ActionForm>
        }
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th className="w-16">Order</Th>
                <Th>Collection</Th>
                <Th>Kind</Th>
                <Th className="text-right">Pieces</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((c) => {
                const n = counts.find((x) => x.collection_id === c.id);
                return (
                  <Tr key={c.id}>
                    <Td>
                      <div className="flex">
                        <ActionButton action={moveCollectionAction} fields={{ id: c.id, dir: "up" }} variant="ghost" title="Move up">
                          <ArrowUp className="size-3.5" />
                        </ActionButton>
                        <ActionButton action={moveCollectionAction} fields={{ id: c.id, dir: "down" }} variant="ghost" title="Move down">
                          <ArrowDown className="size-3.5" />
                        </ActionButton>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Thumb src={c.coverImageUrl} alt={c.title} kind={c.coverImageUrl?.startsWith("/art/") ? "illustration" : "photo"} size={48} />
                        <div>
                          <Link href={`/admin/collections/${c.id}`} className="font-medium text-umber-900 hover:text-terracotta-600">
                            {c.title}
                          </Link>{" "}
                          <DemoBadge show={c.isDemo} />
                          <p className="text-xs text-umber-500">/{c.slug}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>{c.kind === "bundle" ? <Badge tone="terracotta">Bundle · {(c.bundleDiscountBps ?? 0) / 100}% off</Badge> : <Badge tone="neutral">Collection</Badge>}</Td>
                    <Td className="text-right tabular-nums">
                      {n?.active ?? 0}
                      <span className="text-umber-400">/{n?.n ?? 0}</span>
                    </Td>
                    <Td>{c.isPublished ? <Badge tone="success">Published</Badge> : <Badge tone="neutral">Draft</Badge>}</Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>No collections yet.</Empty>
        )}
      </TableCard>
    </div>
  );
}
