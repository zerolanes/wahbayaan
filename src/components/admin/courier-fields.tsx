import { FieldRow, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import type { couriers } from "@/lib/db/schema";

type Courier = typeof couriers.$inferSelect;

/** Shared fields for creating / editing a courier. */
export function CourierFields({ c }: { c?: Courier }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <FieldRow label="Name" htmlFor="c-name">
        <TextInput id="c-name" name="name" defaultValue={c?.name} required />
      </FieldRow>
      <FieldRow label="Tracking URL template" htmlFor="c-track" hint="https://… with {tracking} where the tracking number goes.">
        <TextInput id="c-track" name="trackingUrlTemplate" defaultValue={c?.trackingUrlTemplate ?? ""} placeholder="https://courier.example/track?n={tracking}" />
      </FieldRow>
      <div className="flex flex-wrap gap-4 md:col-span-2">
        <Toggle name="domestic" label="Domestic (within Pakistan)" defaultChecked={c?.domestic} />
        <Toggle name="international" label="International" defaultChecked={c?.international} />
        <Toggle name="isActive" label="Active (rates offered at checkout)" defaultChecked={c?.isActive} />
      </div>
      <FieldRow label="Service levels — one per line: label, min days, max days" htmlFor="c-services">
        <TextArea id="c-services" name="services" defaultValue={(c?.services ?? []).map((s) => [s.label, s.transitDaysMin ?? "", s.transitDaysMax ?? ""].join(", ")).join("\n")} placeholder={"Overnight, 1, 2\nEconomy, 3, 5"} />
      </FieldRow>
      <div className="space-y-3">
        <FieldRow label="Contact" htmlFor="c-contact">
          <TextArea id="c-contact" name="contactNotes" defaultValue={c?.contactNotes ?? ""} className="min-h-14" />
        </FieldRow>
        <FieldRow label="Contract notes" htmlFor="c-contract">
          <TextArea id="c-contract" name="contractNotes" defaultValue={c?.contractNotes ?? ""} className="min-h-14" />
        </FieldRow>
      </div>
    </div>
  );
}
