import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { saveStorefront } from "@/app/actions/seller";
import { ActionForm, SubmitButton } from "@/components/seller/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Badge, Card, CardHeader, Notice, PageHeader } from "@/components/ui/misc";
import { requireSeller } from "@/lib/auth/session";
import { getSellerVendor } from "@/lib/seller/queries";
import { REGION_LABELS } from "@/lib/utils/format";

export const metadata = { title: "Storefront profile" };

export default async function SellerStorefront() {
  const user = await requireSeller();
  const { vendor, issues, publiclyVisible } = await getSellerVendor(user.vendorId);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your shop"
        title="Storefront profile"
        description="Buyers spending hundreds of dollars want to see the hands that made the piece. Your real photo, your workshop and your story matter more than anything else here."
        actions={
          <Link href={`/artisans/${vendor.slug}`} className="text-terracotta-600 inline-flex items-center gap-1 text-sm hover:underline">
            View public profile <ExternalLink className="size-3.5" />
          </Link>
        }
      />
      {publiclyVisible ? (
        <Notice tone="success">Your profile meets every requirement and is visible to buyers.</Notice>
      ) : (
        <Notice tone="gold" title="Not visible to buyers yet">
          <ul className="mt-1 list-disc pl-5">
            {issues.map((i) => (
              <li key={i.code}>{i.message}</li>
            ))}
          </ul>
        </Notice>
      )}

      <ActionForm action={saveStorefront} className="space-y-6">
        <>
          <Card>
            <CardHeader
              title="Photos"
              description="Use your own photos — a portrait of you at work and a wide shot of your workshop or craft. Stock images and shared banners are not accepted."
            />
            <div className="grid gap-6 p-5 md:grid-cols-[auto_1fr]">
              <div className="space-y-3">
                <div className="bg-sand-200 ring-sand-50 relative size-28 overflow-hidden rounded-full ring-4">
                  {vendor.profilePhotoUrl ? (
                    <Image
                      src={vendor.profilePhotoUrl}
                      alt=""
                      fill
                      sizes="112px"
                      unoptimized={vendor.profilePhotoUrl.endsWith(".svg")}
                      className="object-cover"
                    />
                  ) : null}
                </div>
                {vendor.profilePhotoKind === "illustration" ? <Badge tone="pending">Illustration — upload a real photo</Badge> : null}
              </div>
              <div className="space-y-4">
                <Field label="Your photo" htmlFor="profilePhoto" hint="A clear portrait, ideally at work.">
                  <Input id="profilePhoto" name="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp" className="h-auto py-2" />
                </Field>
                <div className="bg-sand-200 relative h-28 overflow-hidden rounded-xl">
                  {vendor.bannerUrl ? (
                    <Image src={vendor.bannerUrl} alt="" fill sizes="600px" unoptimized={vendor.bannerUrl.endsWith(".svg")} className="object-cover" />
                  ) : null}
                </div>
                <Field label="Banner" htmlFor="banner" hint="A wide photo of your workshop or your craft up close (at least 1600 px wide).">
                  <Input id="banner" name="banner" type="file" accept="image/jpeg,image/png,image/webp" className="h-auto py-2" />
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Your story" />
            <div className="grid gap-5 p-5 md:grid-cols-2">
              <Field label="Craft" htmlFor="craft" required>
                <Input id="craft" name="craft" defaultValue={vendor.craft} required />
              </Field>
              <Field label="Tagline" htmlFor="tagline" hint="One line under your name.">
                <Input id="tagline" name="tagline" defaultValue={vendor.tagline ?? ""} maxLength={90} />
              </Field>
              <Field
                label="Your story"
                htmlFor="story"
                className="md:col-span-2"
                required
                hint="At least 80 characters. Who you are, where you work, what you make."
              >
                <Textarea id="story" name="story" defaultValue={vendor.story ?? ""} rows={5} required />
              </Field>
              <Field
                label="Craft history"
                htmlFor="craftHistory"
                className="md:col-span-2"
                hint="Who taught you, how long you've practised, what tradition you belong to."
              >
                <Textarea id="craftHistory" name="craftHistory" defaultValue={vendor.craftHistory ?? ""} rows={4} />
              </Field>
              <Field label="Story video link" htmlFor="storyVideoUrl" hint="YouTube or Instagram.">
                <Input id="storyVideoUrl" name="storyVideoUrl" type="url" defaultValue={vendor.storyVideoUrl ?? ""} placeholder="https://" />
              </Field>
              <Field label="Languages you speak" htmlFor="languages" hint="Comma separated.">
                <Input id="languages" name="languages" defaultValue={vendor.languages.join(", ")} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Workshop" description="Your location is verified by our team and shown as a trust signal." />
            <div className="grid gap-5 p-5 md:grid-cols-3">
              <Field label="City" htmlFor="workshopCity" required>
                <Input id="workshopCity" name="workshopCity" defaultValue={vendor.workshopCity ?? ""} required />
              </Field>
              <Field label="Province / region" htmlFor="workshopRegion" required>
                <Select id="workshopRegion" name="workshopRegion" defaultValue={vendor.workshopRegion ?? "punjab"}>
                  {Object.entries(REGION_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Practising since (year)" htmlFor="foundedYear">
                <Input id="foundedYear" name="foundedYear" type="number" min={1900} max={new Date().getFullYear()} defaultValue={vendor.foundedYear ?? ""} />
              </Field>
              <div className="space-y-3 md:col-span-3">
                <Checkbox name="acceptsCustomOrders" defaultChecked={vendor.acceptsCustomOrders} label="Accept custom commissions from buyers" />
                <Checkbox name="vacationMode" defaultChecked={vendor.vacationMode} label="Vacation mode — buyers see that you're away and new orders pause" />
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <SubmitButton pendingLabel="Saving…">Save storefront</SubmitButton>
          </div>
        </>
      </ActionForm>
    </div>
  );
}
