import { changeSellerPassword, saveSellerAccount } from "@/app/actions/seller";
import { ActionForm, SubmitButton } from "@/components/seller/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Card, CardHeader, PageHeader } from "@/components/ui/misc";
import { requireSeller } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { getSellerVendor } from "@/lib/seller/queries";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const metadata = { title: "Settings" };

export default async function SellerSettings() {
  const user = await requireSeller();
  const d = await db();
  const [{ vendor }, account] = await Promise.all([getSellerVendor(user.vendorId), d.query.users.findFirst({ where: eq(users.id, user.id) })]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account & payout details" description="Payouts are made in Pakistani rupees." />
          <ActionForm action={saveSellerAccount} className="p-5">
            <>
              <Field label="Your name" htmlFor="name">
                <Input id="name" name="name" defaultValue={account?.name} required />
              </Field>
              <Field label="Email" htmlFor="email" hint="Contact support to change your sign-in email.">
                <Input id="email" value={account?.email} disabled readOnly />
              </Field>
              <Field label="Phone / WhatsApp" htmlFor="phone">
                <Input id="phone" name="phone" defaultValue={account?.phone ?? ""} placeholder="+92 3xx xxxxxxx" />
              </Field>
              <Field label="Payout method" htmlFor="payoutMethod">
                <Select id="payoutMethod" name="payoutMethod" defaultValue={vendor.payoutMethod ?? "bank"}>
                  <option value="bank">Bank transfer (IBAN)</option>
                  <option value="mobile_wallet">Mobile wallet</option>
                </Select>
              </Field>
              <Field label="Bank or wallet name" htmlFor="payoutBankName">
                <Input id="payoutBankName" name="payoutBankName" defaultValue={vendor.payoutBankName ?? ""} />
              </Field>
              <Field label="Account title" htmlFor="payoutAccountTitle">
                <Input id="payoutAccountTitle" name="payoutAccountTitle" defaultValue={vendor.payoutAccountTitle ?? ""} />
              </Field>
              <Field
                label="Account number / IBAN"
                htmlFor="payoutAccount"
                hint={
                  vendor.payoutAccountLast4
                    ? `On file: ending ${vendor.payoutAccountLast4}. Only the last four digits are stored here; our finance team confirms the full number with you directly.`
                    : "Only the last four digits are stored here; our finance team confirms the full number with you directly."
                }
              >
                <Input id="payoutAccount" name="payoutAccount" autoComplete="off" />
              </Field>
              <SubmitButton>Save</SubmitButton>
            </>
          </ActionForm>
        </Card>
        <Card className="self-start">
          <CardHeader title="Password" />
          <ActionForm action={changeSellerPassword} className="p-5">
            <>
              <Field label="Current password" htmlFor="current">
                <Input id="current" name="current" type="password" autoComplete="current-password" required />
              </Field>
              <Field label="New password" htmlFor="next" hint="At least 8 characters.">
                <Input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} />
              </Field>
              <SubmitButton variant="outline">Change password</SubmitButton>
            </>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
