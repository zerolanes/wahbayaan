import { FieldRow, SelectInput, TextArea, TextInput, Toggle } from "./controls";

type HubLike = {
  name?: string;
  type?: "origin" | "city" | "forwarder";
  city?: string;
  country?: string;
  address?: { line1: string; line2?: string | null; region?: string | null; postalCode?: string | null };
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  receivingHours?: string | null;
  cutoffTime?: string | null;
  handlingDays?: number | null;
  onwardCourierId?: string | null;
  consolidationCadence?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

/** Fields for creating / editing a hub. Unknown street details stay as `[Add: …]` placeholders. */
export function HubFields({ hub, couriers, idPrefix = "hub" }: { hub?: HubLike; couriers: { id: string; name: string }[]; idPrefix?: string }) {
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldRow label="Name" htmlFor={id("name")}>
          <TextInput id={id("name")} name="name" required defaultValue={hub?.name ?? ""} placeholder="e.g. Lahore export hub" />
        </FieldRow>
        <FieldRow label="Type" htmlFor={id("type")} hint="Forwarder = partner in the buyer's country (later phase)">
          <SelectInput id={id("type")} name="type" defaultValue={hub?.type ?? "origin"}>
            <option value="origin">Origin hub (Pakistan) — consolidates exports</option>
            <option value="city">City hub (Pakistan) — domestic one-delivery (later phase)</option>
            <option value="forwarder">Forwarder (destination country)</option>
          </SelectInput>
        </FieldRow>
        <FieldRow label="Handling days" htmlFor={id("handling")} hint="Check, pack and dispatch once everything is in. Blank = pending">
          <TextInput id={id("handling")} name="handlingDays" inputMode="numeric" defaultValue={hub?.handlingDays ?? ""} />
        </FieldRow>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <FieldRow label="Street address" htmlFor={id("line1")} className="sm:col-span-2">
          <TextInput id={id("line1")} name="line1" required defaultValue={hub?.address?.line1 ?? "[Add: street address]"} />
        </FieldRow>
        <FieldRow label="Line 2" htmlFor={id("line2")} className="sm:col-span-2">
          <TextInput id={id("line2")} name="line2" defaultValue={hub?.address?.line2 ?? ""} />
        </FieldRow>
        <FieldRow label="City" htmlFor={id("city")}>
          <TextInput id={id("city")} name="city" required defaultValue={hub?.city ?? ""} />
        </FieldRow>
        <FieldRow label="Region / state" htmlFor={id("region")}>
          <TextInput id={id("region")} name="region" defaultValue={hub?.address?.region ?? ""} />
        </FieldRow>
        <FieldRow label="Postal code" htmlFor={id("postal")}>
          <TextInput id={id("postal")} name="postalCode" defaultValue={hub?.address?.postalCode ?? "[Add: postal code]"} />
        </FieldRow>
        <FieldRow label="Country" htmlFor={id("country")}>
          <TextInput id={id("country")} name="country" required maxLength={2} defaultValue={hub?.country ?? "PK"} />
        </FieldRow>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldRow label="Contact name" htmlFor={id("cname")}>
          <TextInput id={id("cname")} name="contactName" defaultValue={hub?.contactName ?? ""} />
        </FieldRow>
        <FieldRow label="Contact phone" htmlFor={id("cphone")}>
          <TextInput id={id("cphone")} name="contactPhone" defaultValue={hub?.contactPhone ?? ""} />
        </FieldRow>
        <FieldRow label="Contact email" htmlFor={id("cemail")}>
          <TextInput id={id("cemail")} name="contactEmail" type="email" defaultValue={hub?.contactEmail ?? ""} />
        </FieldRow>
        <FieldRow label="Receiving hours" htmlFor={id("hours")}>
          <TextInput id={id("hours")} name="receivingHours" defaultValue={hub?.receivingHours ?? ""} placeholder="e.g. Mon–Sat 10:00–18:00" />
        </FieldRow>
        <FieldRow label="Cut-off time" htmlFor={id("cutoff")} hint="24h, e.g. 15:00">
          <TextInput id={id("cutoff")} name="cutoffTime" defaultValue={hub?.cutoffTime ?? ""} />
        </FieldRow>
        <FieldRow label="Forwarder: onward courier" htmlFor={id("onward")} hint="Local last mile (forwarders only)">
          <SelectInput id={id("onward")} name="onwardCourierId" defaultValue={hub?.onwardCourierId ?? ""}>
            <option value="">—</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        </FieldRow>
        <FieldRow label="Forwarder: consolidation cadence" htmlFor={id("cadence")}>
          <TextInput id={id("cadence")} name="consolidationCadence" defaultValue={hub?.consolidationCadence ?? ""} placeholder="e.g. weekly air cargo" />
        </FieldRow>
      </div>
      <FieldRow label="Notes" htmlFor={id("notes")}>
        <TextArea id={id("notes")} name="notes" rows={2} className="min-h-16" defaultValue={hub?.notes ?? ""} />
      </FieldRow>
      <Toggle name="isActive" label="Active — receives parcels (an active origin hub consolidates new international orders)" defaultChecked={hub?.isActive ?? false} />
    </div>
  );
}
