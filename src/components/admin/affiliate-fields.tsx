import { FieldRow, SelectInput, TextArea, TextInput } from "@/components/admin/controls";
import { AFFILIATE_STATUSES } from "@/lib/affiliate";
import type { affiliateProgrammes } from "@/lib/db/schema";

/** Affiliate programme fields shared by the add and edit forms. */
export function AffiliateFields({ p }: { p?: typeof affiliateProgrammes.$inferSelect }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FieldRow label="Programme name" htmlFor="af-name">
        <TextInput id="af-name" name="name" defaultValue={p?.name} required maxLength={120} />
      </FieldRow>
      <FieldRow label="Store name (shown as “Shop at …”)" htmlFor="af-brand">
        <TextInput id="af-brand" name="brandName" defaultValue={p?.brandName} required maxLength={80} />
      </FieldRow>
      <FieldRow label="Network" htmlFor="af-network" hint="Free text, e.g. the network's name or “direct”">
        <TextInput id="af-network" name="network" defaultValue={p?.network ?? ""} maxLength={120} />
      </FieldRow>
      <FieldRow label="Status" htmlFor="af-status">
        <SelectInput id="af-status" name="status" defaultValue={p?.status ?? "draft"}>
          {AFFILIATE_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </SelectInput>
      </FieldRow>
      <FieldRow label="Terms URL" htmlFor="af-terms">
        <TextInput id="af-terms" name="termsUrl" defaultValue={p?.termsUrl ?? ""} placeholder="https://" />
      </FieldRow>
      <FieldRow label="Product feed URL (CSV, optional)" htmlFor="af-feed">
        <TextInput id="af-feed" name="feedUrl" defaultValue={p?.feedUrl ?? ""} placeholder="https://…/feed.csv" />
      </FieldRow>
      <FieldRow label="Tracking-link template" htmlFor="af-template" className="sm:col-span-2" hint="From the programme. {url} is replaced by the product link, e.g. https://track.example/click?id=123&url={url}">
        <TextInput id="af-template" name="trackingTemplate" defaultValue={p?.trackingTemplate ?? ""} className="font-mono text-xs" />
      </FieldRow>
      <FieldRow label="Notes" htmlFor="af-notes" className="sm:col-span-2">
        <TextArea id="af-notes" name="notes" defaultValue={p?.notes ?? ""} rows={2} />
      </FieldRow>
    </div>
  );
}
