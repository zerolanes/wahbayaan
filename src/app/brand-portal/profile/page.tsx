import { eq } from "drizzle-orm";
import { updatePortalProfile } from "@/app/actions/brand-portal";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { ImageInput } from "@/components/admin/client-bits";
import { FieldRow, SelectInput, TextArea, TextInput } from "@/components/admin/controls";
import { KV, Panel } from "@/components/admin/ui";
import { PageHeader } from "@/components/ui/misc";
import { requireBrandMember } from "@/lib/brand-portal/access";
import { sizeGuideToText } from "@/lib/brands/size-guide";
import { db } from "@/lib/db/client";
import { brandProfiles, brandTermsAcceptances } from "@/lib/db/schema";
import { SOCIAL_NETWORKS } from "@/lib/social";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Brand page" };

export default async function PortalProfile() {
  const user = await requireBrandMember();
  const b = user.brand;
  const d = await db();
  const [profile, acceptance] = await Promise.all([
    d.query.brandProfiles.findFirst({ where: eq(brandProfiles.brandId, b.id) }),
    d.query.brandTermsAcceptances.findFirst({ where: eq(brandTermsAcceptances.brandId, b.id), orderBy: (t, { desc }) => desc(t.acceptedAt) }),
  ]);
  const version = `${b.updatedAt.getTime()}-${profile?.updatedAt.getTime() ?? 0}`;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Your brand" title="Brand page" description={`What buyers see at wahbayaan.com/brands/${b.slug}. Your name and page address are set by Wahbayaan — ask us to change them.`} />
      <ActionForm action={updatePortalProfile} inline className="space-y-6" key={version}>
        <Panel title="Logo and banner" description="Logo: square, at least 400 × 400 px. Banner: wide photo, at least 1600 px across.">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Logo</p>
              {b.logoUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.logoUrl} alt={`${b.name} logo`} className="size-20 rounded-xl bg-white object-contain p-1 ring-1 ring-umber-200" />
                  <label className="flex items-center gap-1.5 text-xs text-umber-600">
                    <input type="checkbox" name="removeLogo" className="size-3.5" /> Remove
                  </label>
                </div>
              ) : null}
              <ImageInput name="logo" label={b.logoUrl ? "Replace logo" : "Choose logo"} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Banner</p>
              {profile?.bannerUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.bannerUrl} alt={`${b.name} banner`} className="h-20 w-48 rounded-xl object-cover ring-1 ring-umber-200" />
                  <label className="flex items-center gap-1.5 text-xs text-umber-600">
                    <input type="checkbox" name="removeBanner" className="size-3.5" /> Remove
                  </label>
                </div>
              ) : null}
              <ImageInput name="banner" label={profile?.bannerUrl ? "Replace banner" : "Choose banner"} />
            </div>
          </div>
        </Panel>

        <Panel title="About">
          <div className="grid gap-4">
            <FieldRow label="About the brand" htmlFor="description" hint="Two or three short lines.">
              <TextArea id="description" name="description" defaultValue={b.description ?? ""} rows={3} maxLength={2000} />
            </FieldRow>
            <FieldRow label="Website" htmlFor="websiteUrl">
              <TextInput id="websiteUrl" name="websiteUrl" defaultValue={b.websiteUrl ?? ""} placeholder="https://" />
            </FieldRow>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">For</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {(["women", "men", "kids", "unisex"] as const).map((a) => (
                  <label key={a} className="inline-flex items-center gap-1.5">
                    <input type="checkbox" name="audiences" value={a} defaultChecked={b.audiences.includes(a)} className="size-4" /> {a[0].toUpperCase() + a.slice(1)}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Panel>

        <Panel title="Social links" description="Shown as icons on your brand page. Leave blank to hide.">
          <div className="grid gap-4 md:grid-cols-2">
            {SOCIAL_NETWORKS.map((n) => (
              <FieldRow key={n.key} label={n.label} htmlFor={`social-${n.key}`}>
                <TextInput id={`social-${n.key}`} name={`social.${n.key}`} defaultValue={profile?.socials[n.key] ?? ""} placeholder={n.placeholder} />
              </FieldRow>
            ))}
          </div>
        </Panel>

        <Panel title="Size guide" description="First line: headings (the first is the size). Then one size per line, comma separated.">
          <div className="grid gap-4 md:grid-cols-[1fr_160px]">
            <FieldRow label="Chart" htmlFor="sizeGrid">
              <TextArea id="sizeGrid" name="sizeGrid" rows={6} defaultValue={sizeGuideToText(b.sizeGuide)} placeholder={"Size, Chest, Waist, Length\nS, 36, 32, 41\nM, 38, 34, 42"} className="font-mono text-xs" />
            </FieldRow>
            <div className="space-y-4">
              <FieldRow label="Unit" htmlFor="sizeUnit">
                <SelectInput id="sizeUnit" name="sizeUnit" defaultValue={b.sizeGuide?.unit ?? "in"}>
                  <option value="in">Inches</option>
                  <option value="cm">Centimetres</option>
                </SelectInput>
              </FieldRow>
              <FieldRow label="Note" htmlFor="sizeNote">
                <TextInput id="sizeNote" name="sizeNote" defaultValue={b.sizeGuide?.note ?? ""} maxLength={500} />
              </FieldRow>
            </div>
          </div>
        </Panel>

        <SubmitButton size="md">Save brand page</SubmitButton>
      </ActionForm>

      <Panel title="Seller terms">
        {acceptance ? (
          <KV
            items={[
              ["Accepted by", `${acceptance.name} <${acceptance.email}>`],
              ["When", formatDateTime(acceptance.acceptedAt)],
              ["Version", acceptance.termsVersion],
            ]}
          />
        ) : (
          <p className="text-sm text-umber-500">No acceptance on file.</p>
        )}
      </Panel>
    </div>
  );
}
