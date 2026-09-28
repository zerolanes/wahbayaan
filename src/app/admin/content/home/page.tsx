import { asc } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { saveHomeAction } from "@/app/actions/admin/content";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, TextArea, TextInput } from "@/components/admin/controls";
import { AuditTrail } from "@/components/admin/notes-panel";
import { DemoBadge, DetailGrid, Panel, StatusBadge, Thumb } from "@/components/admin/ui";
import { Badge, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { vendors } from "@/lib/db/schema";
import { getPublicVendorIds } from "@/lib/queries/catalog";
import { getSetting, SETTING_DEFAULTS } from "@/lib/settings";

export const metadata = { title: "Homepage" };

export default async function HomeContentPage() {
  await requireStaff("content.manage");
  const d = await db();
  const [home, all, publicIds] = await Promise.all([
    getSetting("home"),
    d
      .select({ id: vendors.id, name: vendors.displayName, craft: vendors.craft, city: vendors.workshopCity, status: vendors.status, isFeatured: vendors.isFeatured, photo: vendors.profilePhotoUrl, photoKind: vendors.profilePhotoKind, isDemo: vendors.isDemo })
      .from(vendors)
      .orderBy(asc(vendors.displayName)),
    getPublicVendorIds(),
  ]);
  const picked = new Set(home.featuredVendorIds);
  const hiddenPicks = home.featuredVendorIds.filter((id) => !publicIds.has(id));
  const d0 = SETTING_DEFAULTS.home;

  const main = (
    <>
      <Panel title="Hero" description="The first thing buyers read on the homepage (and the 3D haveli walk-through).">
        <div className="space-y-4">
          <FieldRow label="Eyebrow" hint={`Short line above the title. Default: “${d0.heroEyebrow}”`}>
            <TextInput name="heroEyebrow" form="home-form" defaultValue={home.heroEyebrow} maxLength={120} required />
          </FieldRow>
          <FieldRow label="Title" hint="Keep it under ~45 characters so it fits on two lines.">
            <TextInput name="heroTitle" form="home-form" defaultValue={home.heroTitle} maxLength={120} required />
          </FieldRow>
          <FieldRow label="Subtitle">
            <TextArea name="heroSubtitle" form="home-form" defaultValue={home.heroSubtitle} rows={3} maxLength={400} required />
          </FieldRow>
        </div>
      </Panel>

      <Panel
        title="Featured artisans"
        description="Shown in “Meet the makers” (up to 8). Leave all unticked to show artisans flagged as featured, then the rest."
        bodyClassName="p-0"
      >
        {hiddenPicks.length ? (
          <div className="px-5 pt-4">
            <Notice tone="pending" title={`${hiddenPicks.length} picked artisan${hiddenPicks.length === 1 ? " isn't" : "s aren't"} public`}>
              The storefront guards hide artisans who aren&apos;t verified or whose profile is incomplete, so they won&apos;t appear until fixed.
            </Notice>
          </div>
        ) : null}
        <ul className="grid divide-y divide-umber-200/60 sm:grid-cols-2 sm:divide-y-0">
          {all.map((v) => (
            <li key={v.id} className="border-umber-200/60 sm:border-b">
              <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-umber-50">
                <input type="checkbox" name="featuredVendorIds" value={v.id} form="home-form" defaultChecked={picked.has(v.id)} className="size-4 accent-indigo-800" />
                <Thumb src={v.photo} alt={v.name} kind={v.photoKind} size={32} className="rounded-full" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-umber-900">
                    {v.name} <DemoBadge show={v.isDemo} />
                  </span>
                  <span className="block truncate text-xs text-umber-500">
                    {v.craft}
                    {v.city ? ` · ${v.city}` : ""}
                  </span>
                </span>
                {publicIds.has(v.id) ? v.isFeatured ? <Badge tone="neutral">Featured</Badge> : null : v.status === "verified" ? <Badge tone="warning" title="Verified but hidden by the storefront guards (incomplete profile)">Hidden</Badge> : <StatusBadge kind="vendor" status={v.status} />}
              </label>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );

  const side = (
    <>
      <Panel title="Publish" description="Changes go live on the next page load.">
        <ActionForm id="home-form" action={saveHomeAction} inline className="space-y-3">
          <SubmitButton variant="primary">Save homepage</SubmitButton>
        </ActionForm>
        <a href="/" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-indigo-800 hover:underline">
          View the storefront <ExternalLink className="size-3.5" />
        </a>
      </Panel>
      <Panel title="Current hero">
        <p className="text-xs font-semibold tracking-wide text-umber-500 uppercase">{home.heroEyebrow}</p>
        <p className="mt-2 text-xl font-semibold text-umber-900">{home.heroTitle}</p>
        <p className="mt-2 text-sm text-umber-600">{home.heroSubtitle}</p>
        <p className="mt-3 text-xs text-umber-500">{home.featuredVendorIds.length ? `${home.featuredVendorIds.filter((id) => publicIds.has(id)).length} featured artisan(s) visible` : "Featured artisans chosen automatically"}</p>
      </Panel>
      <AuditTrail entity="setting" entityId="home" />
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Content" title="Homepage" description="Hero copy and the artisans featured on the storefront homepage." />
      <DetailGrid main={main} side={side} />
    </div>
  );
}
