import type { coupons } from "@/lib/db/schema";
import { bpsToPercentString, minorToInput } from "@/lib/admin/money";
import { FieldRow, SelectInput, TextInput, Toggle } from "./controls";

type Coupon = typeof coupons.$inferSelect;

const dt = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16) : "");

/** Shared create/edit fields for a coupon. Times are UTC. */
export function CouponFields({ c }: { c?: Coupon }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FieldRow label="Code" hint="Buyers type this at checkout; stored upper-case.">
        <TextInput name="code" defaultValue={c?.code ?? ""} placeholder="WELCOME10" required className="font-mono uppercase" />
      </FieldRow>
      <FieldRow label="Internal description">
        <TextInput name="description" defaultValue={c?.description ?? ""} placeholder="What it's for" />
      </FieldRow>
      <FieldRow label="Discount type">
        <SelectInput name="kind" defaultValue={c?.kind ?? "percent"}>
          <option value="percent">Percentage of items</option>
          <option value="fixed">Fixed amount (buyer currency)</option>
        </SelectInput>
      </FieldRow>
      <FieldRow label="Percent off" hint="Percentage coupons only (max 90%).">
        <TextInput name="percent" defaultValue={bpsToPercentString(c?.percentBps)} inputMode="decimal" placeholder="10" />
      </FieldRow>
      <FieldRow label="Amount off" hint="Fixed coupons only; converted at the live rate for other currencies.">
        <TextInput name="amount" defaultValue={minorToInput(c?.amount)} inputMode="decimal" placeholder="25" />
      </FieldRow>
      <FieldRow label="Currency" hint="For the fixed amount and the minimum order.">
        <SelectInput name="currency" defaultValue={c?.currency ?? ""}>
          <option value="">—</option>
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
          <option value="CAD">CAD</option>
        </SelectInput>
      </FieldRow>
      <FieldRow label="Minimum items subtotal" hint="Optional, in the currency above.">
        <TextInput name="minSubtotal" defaultValue={minorToInput(c?.minSubtotal)} inputMode="decimal" placeholder="200" />
      </FieldRow>
      <FieldRow label="Maximum uses" hint="Leave empty for unlimited.">
        <TextInput name="maxUses" defaultValue={c?.maxUses ?? ""} inputMode="numeric" placeholder="Unlimited" />
      </FieldRow>
      <FieldRow label="Starts (UTC)">
        <TextInput type="datetime-local" name="startsAt" defaultValue={dt(c?.startsAt)} />
      </FieldRow>
      <FieldRow label="Ends (UTC)">
        <TextInput type="datetime-local" name="endsAt" defaultValue={dt(c?.endsAt)} />
      </FieldRow>
      <Toggle name="isActive" label="Enabled" defaultChecked={c?.isActive ?? true} className="sm:col-span-2" />
    </div>
  );
}
