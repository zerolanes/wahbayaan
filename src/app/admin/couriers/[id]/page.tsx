import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { addCourierRateAction, deleteCourierRateAction, updateCourierAction, updateCourierRateAction } from "@/app/actions/admin/couriers";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { CourierFields } from "@/components/admin/courier-fields";
import { FieldRow, SelectInput, TextInput } from "@/components/admin/controls";
import { Panel, StatusBadge, TableCard, Empty } from "@/components/admin/ui";
import { Breadcrumbs, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { minorToInput } from "@/lib/admin/money";
import { db } from "@/lib/db/client";
import { couriers, shippingRates } from "@/lib/db/schema";
import { BUYER_DESTINATIONS, destinationName } from "@/lib/money/currency";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Courier" };

export default async function CourierPage(props: PageProps<"/admin/couriers/[id]">) {
  await requireStaff("couriers.manage");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await db();
  const c = await d.query.couriers.findFirst({ where: eq(couriers.id, id) });
  if (!c) notFound();
  const [rates, domestic] = await Promise.all([
    d.select().from(shippingRates).where(eq(shippingRates.courierId, id)).orderBy(asc(shippingRates.destinationCountry), asc(shippingRates.zone), asc(shippingRates.minWeightG)),
    getSetting("domestic_delivery"),
  ]);
  const dests = BUYER_DESTINATIONS.filter((x) => (x.code === "PK" ? c.domestic : c.international));
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Couriers", href: "/admin/couriers" }, { label: c.name }]} />
      <PageHeader title={c.name} description={c.isActive ? "Active — its active rates are offered at checkout." : "Inactive — none of its rates are offered until it's switched on."} />
      <TableCard toolbar={<p className="text-sm font-medium text-umber-900">Rate card (amounts in PKR)</p>}>
        {rates.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Destination</Th>
                <Th>Zone</Th>
                <Th>Service</Th>
                <Th>Weight band</Th>
                <Th>Amount · status · transit days</Th>
                <Th />
              </tr>
            </THead>
            <TBody>
              {rates.map((r) => (
                <Tr key={r.id}>
                  <Td className="text-sm">{destinationName(r.destinationCountry)}</Td>
                  <Td className="text-sm">{r.zone ? (domestic.zones.find((z) => z.key === r.zone)?.label ?? r.zone) : "—"}</Td>
                  <Td className="text-sm">{r.serviceName ?? "—"}</Td>
                  <Td className="text-sm whitespace-nowrap tabular-nums">
                    {r.minWeightG}–{r.maxWeightG} g
                  </Td>
                  <Td>
                    <ActionForm action={updateCourierRateAction} className="flex flex-wrap items-center gap-1.5">
                      <input type="hidden" name="id" value={r.id} />
                      <TextInput name="amount" defaultValue={minorToInput(r.amount)} placeholder="Pending" className="w-24" aria-label="Amount in PKR" />
                      <SelectInput name="status" defaultValue={r.status} className="w-28" aria-label="Status">
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                      </SelectInput>
                      <TextInput name="transitDaysMin" defaultValue={r.transitDaysMin ?? ""} className="w-14" aria-label="Min days" />
                      <TextInput name="transitDaysMax" defaultValue={r.transitDaysMax ?? ""} className="w-14" aria-label="Max days" />
                      <SubmitButton variant="ghost">Save</SubmitButton>
                      <StatusBadge kind="config" status={r.status} />
                    </ActionForm>
                  </Td>
                  <Td>
                    <ActionButton action={deleteCourierRateAction} fields={{ id: r.id, courierId: c.id }} variant="ghost" confirm="Delete this rate row?">
                      Delete
                    </ActionButton>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No rates yet — add the negotiated rate card below.</Empty>
        )}
      </TableCard>
      <Panel title="Add a rate" description="Domestic rates need a city zone; international ones a destination. Leave the amount empty to add a pending row.">
        <ActionForm action={addCourierRateAction} inline className="grid gap-3 md:grid-cols-4">
          <input type="hidden" name="courierId" value={c.id} />
          <FieldRow label="Destination" htmlFor="r-dest">
            <SelectInput id="r-dest" name="destination">
              {dests.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.name}
                </option>
              ))}
            </SelectInput>
          </FieldRow>
          <FieldRow label="Zone (Pakistan only)" htmlFor="r-zone">
            <SelectInput id="r-zone" name="zone" defaultValue="">
              <option value="">—</option>
              {domestic.zones.map((z) => (
                <option key={z.key} value={z.key}>
                  {z.label}
                </option>
              ))}
            </SelectInput>
          </FieldRow>
          <FieldRow label="Service" htmlFor="r-svc">
            <SelectInput id="r-svc" name="serviceName" defaultValue="">
              <option value="">—</option>
              {c.services.map((s) => (
                <option key={s.key} value={s.label}>
                  {s.label}
                </option>
              ))}
            </SelectInput>
          </FieldRow>
          <FieldRow label="Amount (PKR)" htmlFor="r-amt">
            <TextInput id="r-amt" name="amount" placeholder="blank = pending" />
          </FieldRow>
          <FieldRow label="From (g)" htmlFor="r-min">
            <TextInput id="r-min" name="minWeightG" type="number" defaultValue={0} />
          </FieldRow>
          <FieldRow label="To (g)" htmlFor="r-max">
            <TextInput id="r-max" name="maxWeightG" type="number" defaultValue={1000} />
          </FieldRow>
          <FieldRow label="Transit min days" htmlFor="r-tmin">
            <TextInput id="r-tmin" name="transitDaysMin" type="number" />
          </FieldRow>
          <FieldRow label="Transit max days" htmlFor="r-tmax">
            <TextInput id="r-tmax" name="transitDaysMax" type="number" />
          </FieldRow>
          <div className="md:col-span-4">
            <SubmitButton>Add rate</SubmitButton>
          </div>
        </ActionForm>
      </Panel>
      <Panel title="Courier details">
        <ActionForm action={updateCourierAction} inline className="space-y-4">
          <input type="hidden" name="id" value={c.id} />
          <CourierFields c={c} />
          <SubmitButton>Save courier</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
