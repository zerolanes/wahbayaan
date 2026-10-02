import Link from "next/link";
import { and, eq, isNotNull } from "drizzle-orm";
import { saveDomesticZonesAction } from "@/app/actions/admin/brand-settings";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, TextArea, TextInput } from "@/components/admin/controls";
import { Panel } from "@/components/admin/ui";
import { Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { shippingRates } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Domestic delivery zones" };

export default async function DomesticZonesPage() {
  await requireStaff("couriers.manage");
  const setting = await getSetting("domestic_delivery");
  const d = await db();
  const rates = await d.select().from(shippingRates).where(and(eq(shippingRates.destinationCountry, "PK"), isNotNull(shippingRates.zone)));
  const zones = [...setting.zones, { key: "", label: "", cities: [] as string[] }];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Delivery & payments"
        title="Delivery within Pakistan"
        description="City zones decide which domestic rate applies. Rates per zone and weight live on each courier's rate card. Until a zone, city and active rate exist, buyers see delivery as Pending."
      />
      <Notice tone="indigo">
        {rates.filter((r) => r.status === "active" && r.amount != null).length} active domestic rates of {rates.length}.{" "}
        <Link href="/admin/couriers" className="underline">
          Manage couriers and rate cards
        </Link>
        .
      </Notice>
      <Panel title="Zones and handling time">
        <ActionForm action={saveDomesticZonesAction} inline className="space-y-4">
          {zones.map((z, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-umber-200 p-3 md:grid-cols-[160px_220px_1fr]">
              <TextInput name="zoneKey[]" defaultValue={z.key} placeholder="key, e.g. major_cities" aria-label={`Zone ${i + 1} key`} />
              <TextInput name="zoneLabel[]" defaultValue={z.label} placeholder="Label" aria-label={`Zone ${i + 1} label`} />
              <TextArea name="zoneCities[]" defaultValue={z.cities.join(", ")} placeholder="Cities, comma separated (leave empty for “other” = everywhere else)" aria-label={`Zone ${i + 1} cities`} className="min-h-10" />
            </div>
          ))}
          <p className="text-xs text-umber-500">The zone with key “other” catches every city not listed elsewhere. Clear a row's key to remove it.</p>
          <FieldRow label="Handling days (brand → dispatch from Wahbayaan)" htmlFor="handlingDays" hint="Blank = pending; shown to buyers as part of the delivery estimate.">
            <TextInput id="handlingDays" name="handlingDays" type="number" defaultValue={setting.handlingDays ?? ""} className="w-32" />
          </FieldRow>
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
