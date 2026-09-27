import { asc, sql } from "drizzle-orm";
import { ArrowDown, ArrowUp, CheckCircle2, EyeOff } from "lucide-react";
import { createCategoryAction, deleteCategoryAction, moveCategoryAction, removeCategoryCoverAction, updateCategoryAction } from "@/app/actions/admin/categories";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { ImageInput } from "@/components/admin/client-bits";
import { FieldRow, SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { DemoBadge, Panel } from "@/components/admin/ui";
import { Badge, Card, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/settings";
import { categoryIssues } from "@/lib/trust/visibility";
import { query } from "@/lib/admin/sql";

export const metadata = { title: "Categories" };

function CategoryFields({ c }: { c?: typeof categories.$inferSelect }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <FieldRow label="Name">
        <TextInput name="name" defaultValue={c?.name} required />
      </FieldRow>
      <FieldRow label="Slug" hint="Leave empty to derive from the name">
        <TextInput name="slug" defaultValue={c?.slug} />
      </FieldRow>
      <FieldRow label="Tagline" className="md:col-span-2">
        <TextInput name="tagline" defaultValue={c?.tagline ?? ""} />
      </FieldRow>
      <FieldRow label="Description" className="md:col-span-2">
        <TextArea name="description" defaultValue={c?.description ?? ""} rows={3} />
      </FieldRow>
      <FieldRow label="Default HS code" hint="Used on commercial invoices and duty lookups. Confirm with your customs broker — don't guess.">
        <TextInput name="hsCode" defaultValue={c?.hsCode ?? ""} placeholder="e.g. 5701.10" />
      </FieldRow>
      <FieldRow label="Cover image" hint="Real photography preferred; illustrations are flagged on the readiness check">
        <ImageInput name="cover" label={c?.coverImageUrl ? "Replace cover" : "Upload cover"} />
        <SelectInput name="coverKind" defaultValue={c?.coverKind ?? "photo"} aria-label="Cover type">
          <option value="photo">Cover is a real photograph</option>
          <option value="illustration">Cover is an illustration</option>
        </SelectInput>
      </FieldRow>
      <div className="flex flex-wrap gap-5 md:col-span-2">
        <Toggle name="isVisible" label="Visible on the storefront" defaultChecked={c?.isVisible ?? true} />
        <Toggle name="showOnHome" label="Show on the homepage grid" defaultChecked={c?.showOnHome ?? true} />
      </div>
    </div>
  );
}

export default async function CategoriesPage() {
  await requireStaff("categories.manage");
  const d = await db();
  const [cats, counts] = await Promise.all([
    d.select().from(categories).orderBy(asc(categories.sort), asc(categories.name)),
    query<{ category_id: string; n: number; active: number }>(sql`select category_id, count(*)::int as n, count(*) filter (where status = 'active')::int as active from products group by category_id`),
  ]);
  const ctx = { demoMode: isDemoMode() };
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Marketplace" title="Categories" description="The craft taxonomy buyers browse. A category without a cover never renders — no gray placeholder tiles." />
      <Notice tone="indigo" title="HS codes">
        Harmonized System codes decide the import duty buyers pay. Enter the code your customs broker confirms for each craft (e.g. hand-knotted wool carpets are usually under 5701). Listings can override it.
      </Notice>
      <div className="space-y-3">
        {cats.map((c, i) => {
          const issues = categoryIssues(c, ctx);
          const n = counts.find((x) => x.category_id === c.id);
          return (
            <Card key={c.id} id={c.id} className="flex scroll-mt-24 overflow-hidden">
              <div className="flex shrink-0 flex-col justify-center gap-1 border-r border-umber-200/60 px-1.5">
                <ActionButton action={moveCategoryAction} fields={{ id: c.id, dir: "up" }} variant="ghost" title="Move up">
                  <ArrowUp className={i === 0 ? "size-4 opacity-30" : "size-4"} />
                </ActionButton>
                <ActionButton action={moveCategoryAction} fields={{ id: c.id, dir: "down" }} variant="ghost" title="Move down">
                  <ArrowDown className={i === cats.length - 1 ? "size-4 opacity-30" : "size-4"} />
                </ActionButton>
              </div>
              <details className="min-w-0 flex-1">
                <summary className="flex cursor-pointer list-none items-center gap-4 p-4 hover:bg-gold-50/40 [&::-webkit-details-marker]:hidden">
                  <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-umber-100">
                    {c.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.coverImageUrl} alt={`${c.name} cover`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-[10px] text-umber-500">No cover</div>
                    )}
                    {c.coverKind === "illustration" ? <span className="absolute right-0 bottom-0 left-0 bg-indigo-950/70 text-center text-[9px] text-sand-50">illustration</span> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-umber-900">
                      {c.name} <span className="text-xs font-normal text-umber-500">/{c.slug}</span> <DemoBadge show={c.isDemo} />
                    </p>
                    <p className="truncate text-sm text-umber-500">{c.tagline}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-umber-500">
                      {n?.active ?? 0} active / {n?.n ?? 0} listings · HS {c.hsCode ? <code>{c.hsCode}</code> : <Badge tone="pending">Not set</Badge>}
                      {c.showOnHome ? <Badge tone="neutral">On homepage</Badge> : null}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {issues.length ? (
                      <Badge tone="warning" title={issues.map((x) => x.message).join("\n")}>
                        <EyeOff className="size-3" /> Hidden: {issues.map((x) => x.code.replace("_", " ")).join(", ")}
                      </Badge>
                    ) : (
                      <Badge tone="success">
                        <CheckCircle2 className="size-3" /> Shows publicly
                      </Badge>
                    )}
                  </div>
                </summary>
                <div className="border-t border-umber-200 bg-sand-100/40 p-5">
                  {issues.length ? <p className="mb-4 text-sm text-warning-700">Would this show publicly? No — {issues.map((x) => x.message).join("; ")}.</p> : <p className="mb-4 text-sm text-success-700">Would this show publicly? Yes.</p>}
                  <ActionForm action={updateCategoryAction} inline className="space-y-4">
                    <input type="hidden" name="id" value={c.id} />
                    <CategoryFields c={c} />
                    <div className="flex flex-wrap gap-2">
                      <SubmitButton variant="primary">Save category</SubmitButton>
                    </div>
                  </ActionForm>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-umber-200 pt-4">
                    {c.coverImageUrl ? (
                      <ActionButton action={removeCategoryCoverAction} fields={{ id: c.id }} confirm="Remove the cover? The category will be hidden until a new cover is uploaded.">
                        Remove cover
                      </ActionButton>
                    ) : null}
                    <ActionButton action={deleteCategoryAction} fields={{ id: c.id }} variant="danger" confirm={`Delete “${c.name}”? Only possible when it has no listings.`}>
                      Delete category
                    </ActionButton>
                  </div>
                </div>
              </details>
            </Card>
          );
        })}
      </div>
      <Panel title="Add a category">
        <ActionForm action={createCategoryAction} inline resetOnSuccess className="space-y-4">
          <CategoryFields />
          <SubmitButton variant="primary">Create category</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
