import { savePaymentMethodAction } from "@/app/actions/admin/brand-settings";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextInput, Toggle } from "@/components/admin/controls";
import { Panel } from "@/components/admin/ui";
import { Badge, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { testPaymentsAllowed } from "@/lib/payments";
import { METHOD_SECRETS, METHOD_STATUS_LABEL, methodAvailability, PAYMENT_METHODS } from "@/lib/payments/methods";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Payment methods" };

export default async function PaymentMethodsPage() {
  await requireStaff("payments.manage");
  const setting = await getSetting("payment_methods");
  const test = testPaymentsAllowed();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Delivery & payments"
        title="Payment methods"
        description="Card, JazzCash and Easypaisa, switched on per market. Only non-secret settings are stored here; keys, passwords and hash salts are environment variables and are shown only as set / not set."
      />
      <Notice tone="pending" title="JazzCash and Easypaisa await merchant accounts">
        Their live checkout is connected once the merchant accounts (and the providers&apos; integration documents) are in place. Until then they show as “Awaiting merchant account”; with credentials in sandbox mode they run through the clearly labelled simulator in development and demo only.
      </Notice>
      <div className="grid gap-6 xl:grid-cols-3">
        {PAYMENT_METHODS.map((m) => {
          const cfg = setting[m];
          const dom = methodAvailability(m, cfg, "domestic", process.env, test);
          const intl = methodAvailability(m, cfg, "international", process.env, test);
          return (
            <Panel key={m} title={cfg.displayName} description={m === "card" ? "Uses the existing Stripe checkout; without a key, the labelled test mode." : undefined}>
              <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-umber-500">Pakistan</dt>
                <dd>
                  <Badge tone={dom.available ? (dom.status === "live" ? "success" : "pending") : "neutral"}>{METHOD_STATUS_LABEL[dom.status]}</Badge>
                </dd>
                <dt className="text-umber-500">International</dt>
                <dd>
                  <Badge tone={intl.available ? (intl.status === "live" ? "success" : "pending") : "neutral"}>{METHOD_STATUS_LABEL[intl.status]}</Badge>
                </dd>
              </dl>
              <ul className="mb-4 space-y-1 text-xs">
                {METHOD_SECRETS[m].map((s) => (
                  <li key={s.env} className="flex justify-between gap-2">
                    <code className="font-mono">{s.env}</code>
                    <span className={process.env[s.env]?.trim() ? "text-success-700" : "text-umber-500"}>{process.env[s.env]?.trim() ? "set" : "not set"}</span>
                  </li>
                ))}
              </ul>
              <ActionForm action={savePaymentMethodAction} className="space-y-3">
                <input type="hidden" name="method" value={m} />
                <FieldRow label="Name shown at checkout" htmlFor={`${m}-name`}>
                  <TextInput id={`${m}-name`} name="displayName" defaultValue={cfg.displayName} />
                </FieldRow>
                {m !== "card" ? (
                  <FieldRow label={m === "jazzcash" ? "Merchant id" : "Store id"} htmlFor={`${m}-mid`} hint="Not secret. Passwords and hash keys go in environment variables.">
                    <TextInput id={`${m}-mid`} name="merchantId" defaultValue={cfg.merchantId ?? ""} />
                  </FieldRow>
                ) : null}
                <FieldRow label="Mode" htmlFor={`${m}-mode`}>
                  <SelectInput id={`${m}-mode`} name="mode" defaultValue={cfg.mode}>
                    <option value="sandbox">Sandbox</option>
                    <option value="live">Live</option>
                  </SelectInput>
                </FieldRow>
                <Toggle name="enabledDomestic" label="Offer to buyers in Pakistan (PKR)" defaultChecked={cfg.enabledDomestic} />
                <Toggle name="enabledInternational" label="Offer to buyers abroad (USD / GBP / CAD)" defaultChecked={cfg.enabledInternational} />
                <SubmitButton variant="outline">Save</SubmitButton>
              </ActionForm>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
