import { createPortalProduct } from "@/app/actions/brand-portal";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { ImageInput } from "@/components/admin/client-bits";
import { FieldRow, TextInput } from "@/components/admin/controls";
import { Panel } from "@/components/admin/ui";
import { ProductFields } from "@/components/brand-portal/product-fields";
import { Breadcrumbs, PageHeader } from "@/components/ui/misc";
import { requireBrandMember } from "@/lib/brand-portal/access";
import { portalCollections } from "@/lib/brand-portal/queries";

export const metadata = { title: "Add a product" };

export default async function NewPortalProduct() {
  const user = await requireBrandMember();
  const collections = await portalCollections(user.brandId);
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Products", href: "/brand-portal/products" }, { label: "Add a product" }]} />
      <PageHeader title="Add a product" description="Saved as a draft. You can fine-tune each variant's price and stock on the next screen." />
      <ActionForm action={createPortalProduct} inline className="space-y-6">
        <Panel title="Details">
          <ProductFields collections={collections.map((c) => c.name)} />
        </Panel>
        <Panel title="Sizes, colours and price" description="Every size × colour becomes a variant.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Sizes" htmlFor="sizes" hint="Comma separated, e.g. XS, S, M, L">
              <TextInput id="sizes" name="sizes" />
            </FieldRow>
            <FieldRow label="Colours" htmlFor="colours" hint="Comma separated (optional)">
              <TextInput id="colours" name="colours" />
            </FieldRow>
            <FieldRow label="Price (Rs)" htmlFor="price">
              <TextInput id="price" name="price" inputMode="decimal" required placeholder="e.g. 5490" />
            </FieldRow>
            <FieldRow label="Stock per variant" htmlFor="stock" hint="Leave blank if you don't track stock">
              <TextInput id="stock" name="stock" type="number" min={0} />
            </FieldRow>
          </div>
        </Panel>
        <Panel title="Photos" description="JPG, PNG or WebP, up to 10 MB each. The first photo is the main one.">
          <ImageInput name="images" multiple label="Choose photos" />
        </Panel>
        <SubmitButton size="md">Save draft</SubmitButton>
      </ActionForm>
    </div>
  );
}
