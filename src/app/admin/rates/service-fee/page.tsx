import { saveMarginAction } from "@/app/actions/admin/brand-settings";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextInput } from "@/components/admin/controls";
import { Panel } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, Notice, PageHeader } from "@/components/ui/misc";
import { can, requireStaff } from "@/lib/auth/session";
import { bpsToPercentString, minorToInput, parseMoneyInput } from "@/lib/admin/money";
import { str } from "@/lib/admin/params";
import { computeServiceFee, describeTier, OWNER_STARTING_POINT_NOTE, type MarginRule } from "@/lib/brands/margin";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Service fee" };

function RuleForm({ scope, rule, editable }: { scope: "domestic" | "international"; rule: MarginRule; editable: boolean }) {
  const rows = [...rule.tiers, ...Array.from({ length: 3 }, () => ({ minPkr: null, maxPkr: null, feePkr: null }))];
  return (
    <ActionForm action={saveMarginAction} inline className="space-y-4">
      <input type="hidden" name="scope" value={scope} />
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldRow label="Status" htmlFor={`${scope}-status`}>
          <SelectInput id={`${scope}-status`} name="status" defaultValue={rule.status} disabled={!editable}>
            <option value="pending">Pending (shown to buyers as Pending)</option>
            <option value="active">Active</option>
          </SelectInput>
        </FieldRow>
        <FieldRow label="Mode" htmlFor={`${scope}-mode`}>
          <SelectInput id={`${scope}-mode`} name="mode" defaultValue={rule.mode} disabled={!editable}>
            <option value="tiers">Fixed fee by order value</option>
            <option value="percent">Percentage of the items</option>
          </SelectInput>
        </FieldRow>
        <FieldRow label="Percentage (%)" htmlFor={`${scope}-pct`} hint="Percent mode — or the fallback outside every band.">
          <TextInput id={`${scope}-pct`} name="percent" defaultValue={bpsToPercentString(rule.percentBps)} disabled={!editable} />
        </FieldRow>
        <FieldRow label="Minimum fee (PKR)" htmlFor={`${scope}-min`}>
          <TextInput id={`${scope}-min`} name="minFee" defaultValue={minorToInput(rule.minFeePkr)} disabled={!editable} />
        </FieldRow>
        <FieldRow label="Maximum fee (PKR)" htmlFor={`${scope}-max`}>
          <TextInput id={`${scope}-max`} name="maxFee" defaultValue={minorToInput(rule.maxFeePkr)} disabled={!editable} />
        </FieldRow>
        <FieldRow label="Note" htmlFor={`${scope}-note`}>
          <TextInput id={`${scope}-note`} name="note" defaultValue={rule.note ?? ""} disabled={!editable} />
        </FieldRow>
      </div>
      <div>
        <p className="text-xs font-medium tracking-wide text-umber-600">Fixed-fee bands (order value of the items, PKR)</p>
        <div className="mt-2 space-y-2">
          {rows.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr] gap-2">
              <TextInput name="tierMin[]" defaultValue={minorToInput(t.minPkr)} placeholder="From (Rs)" aria-label={`Band ${i + 1} from`} disabled={!editable} />
              <TextInput name="tierMax[]" defaultValue={minorToInput(t.maxPkr)} placeholder="To (Rs, blank = no limit)" aria-label={`Band ${i + 1} to`} disabled={!editable} />
              <TextInput name="tierFee[]" defaultValue={minorToInput(t.feePkr)} placeholder="Fee (Rs, blank = pending)" aria-label={`Band ${i + 1} fee`} disabled={!editable} />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-umber-500">Clear a row to remove it. Order values outside every band use the percentage fallback if one is set; otherwise the fee is pending and the order waits for a staff quote.</p>
      </div>
      {editable ? <SubmitButton>Save {scope} fee</SubmitButton> : null}
    </ActionForm>
  );
}

export default async function ServiceFeePage(props: PageProps<"/admin/rates/service-fee">) {
  const user = await requireStaff("rates.view");
  const params = await props.searchParams;
  const margin = await getSetting("brand_margin");
  const editable = can(user, "rates.manage");
  const amountText = str(params, "amount");
  const amount = amountText ? parseMoneyInput(amountText) : null;
  const preview = (rule: MarginRule) => {
    if (amount == null || Number.isNaN(amount) || amount <= 0) return null;
    const f = computeServiceFee(rule, amount);
    return f.status === "known" ? (
      <span>
        <SellerPrice pkr={f.feePkr} className="font-semibold" /> <span className="text-umber-500">({f.basis})</span>
      </span>
    ) : (
      <span>
        <Badge tone="pending">Pending</Badge> <span className="text-umber-500">{f.reason}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pakistani Brands"
        title="Wahbayaan service fee"
        description="Wahbayaan's margin on brand orders. Buyers always see it as its own “Wahbayaan service fee” line — it is never folded into the item price. Converted to the buyer's currency at checkout."
      />
      {margin.domestic.note === OWNER_STARTING_POINT_NOTE ? <Notice tone="gold" title="Pre-filled with the owner's starting point">{OWNER_STARTING_POINT_NOTE}</Notice> : null}

      <Panel title="What would the fee be?" description="Enter an order value (the items, in PKR).">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <FieldRow label="Order value (Rs)" htmlFor="amount">
            <TextInput id="amount" name="amount" defaultValue={amountText} placeholder="3500" className="w-40" />
          </FieldRow>
          <button className="h-9 rounded-lg bg-umber-900 px-3.5 text-sm font-medium text-white">Calculate</button>
        </form>
        {amount != null && !Number.isNaN(amount) && amount > 0 ? (
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-umber-500">Delivered in Pakistan</dt>
              <dd>{preview(margin.domestic)}</dd>
            </div>
            <div>
              <dt className="text-umber-500">Shipped abroad</dt>
              <dd>{preview(margin.international)}</dd>
            </div>
          </dl>
        ) : null}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Orders delivered in Pakistan"
          description={margin.domestic.mode === "tiers" && margin.domestic.tiers.length ? margin.domestic.tiers.map(describeTier).join(" · ") : undefined}
        >
          <RuleForm scope="domestic" rule={margin.domestic} editable={editable} />
        </Panel>
        <Panel title="Orders shipped abroad" description={margin.international.status === "pending" ? "Not set yet — buyers see the fee as Pending." : undefined}>
          <RuleForm scope="international" rule={margin.international} editable={editable} />
        </Panel>
      </div>
    </div>
  );
}
