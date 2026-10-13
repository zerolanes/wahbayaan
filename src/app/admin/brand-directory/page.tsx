import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { createDirectoryEntryAction, seedDirectoryAction, toggleDirectoryEntryAction, updateDirectoryEntryAction } from "@/app/actions/admin/brand-directory";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextInput, Toggle } from "@/components/admin/controls";
import { EditRow } from "@/components/admin/edit-row";
import { SwitchSubmit } from "@/components/admin/switch";
import { Empty, FilterBar, Panel, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th } from "@/components/ui/table";
import { can, requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { brandDirectoryEntries } from "@/lib/db/schema";
import { categoryLabel, DIRECTORY_CATEGORIES } from "@/lib/directory";
import { str } from "@/lib/admin/params";

export const metadata = { title: "Brand directory" };

function EntryFields({ e }: { e?: typeof brandDirectoryEntries.$inferSelect }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_2fr_1.4fr_90px]">
      <FieldRow label="Brand name">
        <TextInput name="name" defaultValue={e?.name} required maxLength={80} />
      </FieldRow>
      <FieldRow label="Category">
        <SelectInput name="category" defaultValue={e?.category ?? "women"}>
          {DIRECTORY_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </SelectInput>
      </FieldRow>
      <FieldRow label="One factual line" hint="No claims, no contact details">
        <TextInput name="description" defaultValue={e?.description ?? ""} maxLength={160} placeholder="Pakistani womenswear brand." />
      </FieldRow>
      <FieldRow label="Website">
        <TextInput name="websiteUrl" defaultValue={e?.websiteUrl ?? ""} placeholder="https://brand.pk" />
      </FieldRow>
      <FieldRow label="Sort">
        <TextInput name="sort" type="number" min={0} defaultValue={e?.sort ?? 1000} />
      </FieldRow>
    </div>
  );
}

export default async function BrandDirectoryAdmin(props: PageProps<"/admin/brand-directory">) {
  const user = await requireStaff("brands.view");
  const canManage = can(user, "brands.manage");
  const params = await props.searchParams;
  const q = str(params, "q").toLowerCase();
  const d = await db();
  const rows = await d.select().from(brandDirectoryEntries).orderBy(asc(brandDirectoryEntries.sort), asc(brandDirectoryEntries.name));
  const shown = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || (r.websiteUrl ?? "").includes(q)) : rows;
  const [{ hidden }] = await d.select({ hidden: sql<number>`count(*) filter (where is_hidden)::int` }).from(brandDirectoryEntries);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pakistani Brands"
        title="Brand directory"
        description="Text-only list of Pakistani brands that aren't on Wahbayaan: name, category, one factual line and a nofollow link to their website. No logos, photos, products or contact details, and never a claim of partnership. Brands with a live page on Wahbayaan are left out automatically."
        actions={
          <Link href="/brands/directory" className="text-sm text-umber-600 hover:underline">
            View storefront ↗
          </Link>
        }
      />
      {canManage ? (
        <Panel title="Add a brand">
          <ActionForm action={createDirectoryEntryAction} resetOnSuccess className="space-y-3">
            <EntryFields />
            <SubmitButton>Add to directory</SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}
      <FilterBar action="/admin/brand-directory" q={q} placeholder="Brand or website" />
      <TableCard
        toolbar={
          <p className="text-sm text-umber-600">
            {rows.length} entries · {hidden} hidden
          </p>
        }
      >
        {shown.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Brand</Th>
                <Th>Category</Th>
                <Th>Line</Th>
                <Th>Website</Th>
                <Th>Shown</Th>
                <Th>
                  <span className="sr-only">Edit</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {shown.map((e) => (
                <EditRow
                  key={e.id}
                  colSpan={5}
                  cells={
                    <>
                      <Td className="font-medium">
                        {e.name} {e.source === "seed" ? <Badge tone="neutral">seed</Badge> : null}
                      </Td>
                      <Td className="text-sm">{categoryLabel(e.category)}</Td>
                      <Td className="max-w-80 truncate text-sm text-umber-600">{e.description ?? "—"}</Td>
                      <Td className="max-w-56 truncate text-sm">
                        {e.websiteUrl ? (
                          <a href={e.websiteUrl} target="_blank" rel="nofollow noopener noreferrer" className="text-indigo-800 hover:underline">
                            {e.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          </a>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        {canManage ? (
                          <ActionForm action={toggleDirectoryEntryAction}>
                            <input type="hidden" name="id" value={e.id} />
                            <SwitchSubmit on={!e.isHidden} label={`Show ${e.name} in the directory`} />
                          </ActionForm>
                        ) : e.isHidden ? (
                          "Hidden"
                        ) : (
                          "Shown"
                        )}
                      </Td>
                    </>
                  }
                  editor={
                    canManage ? (
                      <ActionForm action={updateDirectoryEntryAction} className="space-y-3">
                        <input type="hidden" name="id" value={e.id} />
                        <EntryFields e={e} />
                        <div className="flex items-center gap-4">
                          <Toggle name="isHidden" label="Hidden" defaultChecked={e.isHidden} />
                          <SubmitButton>Save</SubmitButton>
                        </div>
                      </ActionForm>
                    ) : (
                      <p className="text-sm text-umber-500">Read only.</p>
                    )
                  }
                />
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>
            {rows.length ? (
              "No entries match."
            ) : (
              <span className="flex flex-col items-center gap-3">
                The directory is empty.
                {canManage ? <ActionButton action={seedDirectoryAction}>Load from the outreach list (name, category, website only)</ActionButton> : null}
              </span>
            )}
          </Empty>
        )}
      </TableCard>
    </div>
  );
}
