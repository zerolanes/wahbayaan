import Link from "next/link";
import { deleteCollection, saveCollection } from "@/app/actions/brand-portal";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, TextInput } from "@/components/admin/controls";
import { EditRow } from "@/components/admin/edit-row";
import { Empty, Panel, TableCard } from "@/components/admin/ui";
import { PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th } from "@/components/ui/table";
import { requireBrandMember } from "@/lib/brand-portal/access";
import { portalCollections } from "@/lib/brand-portal/queries";

export const metadata = { title: "Collections" };

export default async function PortalCollections() {
  const user = await requireBrandMember();
  const collections = await portalCollections(user.brandId);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Catalogue" title="Collections" description="Group products (e.g. “Summer Lawn ’26”, “Eid Edit”). Buyers can filter your brand page by collection. Assign products from the product list or each product's page." />
      <Panel title="Add a collection">
        <ActionForm action={saveCollection} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_2fr_100px_auto] sm:items-end">
          <FieldRow label="Name" htmlFor="c-name">
            <TextInput id="c-name" name="name" required maxLength={120} />
          </FieldRow>
          <FieldRow label="Description (optional)" htmlFor="c-desc">
            <TextInput id="c-desc" name="description" maxLength={500} />
          </FieldRow>
          <FieldRow label="Order" htmlFor="c-sort">
            <TextInput id="c-sort" name="sort" type="number" min={0} defaultValue={collections.length} />
          </FieldRow>
          <SubmitButton>Add</SubmitButton>
        </ActionForm>
      </Panel>
      <TableCard>
        {collections.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Collection</Th>
                <Th>Products</Th>
                <Th>Order</Th>
                <Th>
                  <span className="sr-only">Edit</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {collections.map((c) => (
                <EditRow
                  key={c.id}
                  colSpan={3}
                  cells={
                    <>
                      <Td>
                        <span className="font-medium">{c.name}</span>
                        {c.description ? <p className="text-xs text-umber-500">{c.description}</p> : null}
                      </Td>
                      <Td className="text-sm">
                        {c.productCount ? <Link href="/brand-portal/products" className="underline">{c.productCount}</Link> : 0}
                      </Td>
                      <Td className="text-sm">{c.sort}</Td>
                    </>
                  }
                  editor={
                    <div className="flex flex-wrap items-end gap-4">
                      <ActionForm action={saveCollection} className="grid flex-1 gap-3 sm:grid-cols-[1fr_2fr_100px_auto] sm:items-end">
                        <input type="hidden" name="id" value={c.id} />
                        <FieldRow label="Name">
                          <TextInput name="name" defaultValue={c.name} required />
                        </FieldRow>
                        <FieldRow label="Description">
                          <TextInput name="description" defaultValue={c.description ?? ""} />
                        </FieldRow>
                        <FieldRow label="Order">
                          <TextInput name="sort" type="number" min={0} defaultValue={c.sort} />
                        </FieldRow>
                        <SubmitButton>Save</SubmitButton>
                      </ActionForm>
                      <ActionButton action={deleteCollection} fields={{ id: c.id }} variant="danger" confirm={`Remove ${c.name}? Its products stay, without a collection.`}>
                        Remove
                      </ActionButton>
                    </div>
                  }
                />
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No collections yet.</Empty>
        )}
      </TableCard>
    </div>
  );
}
