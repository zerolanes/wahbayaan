import { FieldRow, SelectInput, TextArea, TextInput } from "@/components/admin/controls";

type ProductValues = {
  title?: string;
  description?: string | null;
  audience?: string;
  category?: string | null;
  collection?: string | null;
  fabric?: string | null;
  tags?: string[];
  weightG?: number | null;
};

/** Product details shared by "Add a product" and the product editor. */
export function ProductFields({ p = {}, collections }: { p?: ProductValues; collections: string[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FieldRow label="Title" htmlFor="title" className="sm:col-span-2">
        <TextInput id="title" name="title" defaultValue={p.title} required maxLength={200} />
      </FieldRow>
      <FieldRow label="Description" htmlFor="description" className="sm:col-span-2" hint="Cut, what's included (e.g. shirt, trousers, dupatta), care.">
        <TextArea id="description" name="description" defaultValue={p.description ?? ""} rows={4} />
      </FieldRow>
      <FieldRow label="For" htmlFor="audience">
        <SelectInput id="audience" name="audience" defaultValue={p.audience ?? "women"}>
          <option value="women">Women</option>
          <option value="men">Men</option>
          <option value="kids">Kids</option>
          <option value="unisex">Unisex</option>
        </SelectInput>
      </FieldRow>
      <FieldRow label="Collection" htmlFor="collection">
        <SelectInput id="collection" name="collection" defaultValue={p.collection ?? ""}>
          <option value="">None</option>
          {collections.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectInput>
      </FieldRow>
      <FieldRow label="Category" htmlFor="category" hint="e.g. Unstitched, Pret, Kurta">
        <TextInput id="category" name="category" defaultValue={p.category ?? ""} maxLength={120} />
      </FieldRow>
      <FieldRow label="Fabric / material" htmlFor="fabric">
        <TextInput id="fabric" name="fabric" defaultValue={p.fabric ?? ""} maxLength={120} placeholder="e.g. Lawn, Cotton, Khaddar" />
      </FieldRow>
      <FieldRow label="Tags" htmlFor="tags" hint="Comma separated">
        <TextInput id="tags" name="tags" defaultValue={(p.tags ?? []).join(", ")} />
      </FieldRow>
      <FieldRow label="Parcel weight (grams)" htmlFor="weightG" hint="Used for delivery estimates">
        <TextInput id="weightG" name="weightG" type="number" min={1} max={70000} defaultValue={p.weightG ?? ""} />
      </FieldRow>
    </div>
  );
}
