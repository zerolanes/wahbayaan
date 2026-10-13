import Link from "next/link";
import { asc } from "drizzle-orm";
import { createHubAction, saveCourierAdaptersAction, saveFulfilmentSettingsAction, toggleHubAction } from "@/app/actions/admin/fulfilment";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { HubFields } from "@/components/admin/hub-fields";
import { DemoBadge, Empty, Panel, TableCard } from "@/components/admin/ui";
import { Badge, Notice, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { couriers, hubs } from "@/lib/db/schema";
import { adapterChoices } from "@/lib/fulfilment/couriers/registry";
import { COURIER_PROVIDERS, providerCredentialStatus } from "@/lib/fulfilment/couriers/providers";
import { sandboxAllowed } from "@/lib/fulfilment/couriers/sandbox";
import { hubAddressIsPlaceholder } from "@/lib/fulfilment/service";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Hubs & booking" };

const TYPE_LABEL = { origin: "Origin (exports)", city: "City hub", forwarder: "Forwarder" } as const;

export default async function HubsPage() {
  await requireStaff("hubs.manage");
  const d = await db();
  const [rows, courierRows, setting] = await Promise.all([d.select().from(hubs).orderBy(asc(hubs.type), asc(hubs.name)), d.select().from(couriers).orderBy(asc(couriers.name)), getSetting("fulfilment")]);
  const activeOrigin = rows.find((h) => h.type === "origin" && h.isActive);
  const choices = adapterChoices();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fulfilment"
        title="Hubs & booking"
        description="Where international orders are consolidated, how couriers are booked, and the consolidation rules. Domestic orders always ship direct from each seller."
      />
      {!activeOrigin ? (
        <Notice tone="pending" title="No active origin hub">
          International orders ship direct from each artisan (one parcel per seller) until an origin hub is active.
        </Notice>
      ) : !setting.consolidateInternational ? (
        <Notice tone="gold" title="Consolidation is switched off">
          {activeOrigin.name} is active, but international orders ship direct because consolidation is off below.
        </Notice>
      ) : (
        <Notice tone="success" title={`New international orders consolidate at ${activeOrigin.name}`}>
          Sellers send their parcels there; the hub checks, stores and ships one box per order.
        </Notice>
      )}

      <TableCard>
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Hub</Th>
                <Th>Type</Th>
                <Th>Address</Th>
                <Th>Handling</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((h) => (
                <Tr key={h.id}>
                  <Td>
                    <Link href={`/admin/hubs/${h.id}`} className="font-medium text-indigo-800 hover:underline">
                      {h.name}
                    </Link>{" "}
                    <DemoBadge show={h.isDemo} />
                    <p className="text-xs text-umber-500">
                      {h.city}, {h.country}
                    </p>
                  </Td>
                  <Td className="text-sm">{TYPE_LABEL[h.type]}</Td>
                  <Td className="text-sm">{hubAddressIsPlaceholder(h) ? <Badge tone="pending">Address to add</Badge> : `${h.address.line1}, ${h.city}`}</Td>
                  <Td className="text-sm">{h.handlingDays == null ? <Badge tone="pending">Pending</Badge> : `${h.handlingDays} day${h.handlingDays === 1 ? "" : "s"}`}</Td>
                  <Td>
                    <ActionButton action={toggleHubAction} fields={{ id: h.id }} variant="ghost">
                      {h.isActive ? "Active — switch off" : "Inactive — switch on"}
                    </ActionButton>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No hubs yet. Add the first one below.</Empty>
        )}
      </TableCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Consolidation rules">
          <ActionForm action={saveFulfilmentSettingsAction} inline className="space-y-4">
            <Toggle name="consolidateInternational" label="Consolidate international orders at the active origin hub" defaultChecked={setting.consolidateInternational} />
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Seller counts as late after (days past due)" htmlFor="late">
                <TextInput id="late" name="lateThresholdDays" inputMode="numeric" defaultValue={setting.lateThresholdDays} />
              </FieldRow>
              <FieldRow label="Volumetric divisor (cm³ per kg)" htmlFor="divisor" hint="Match your courier contract (often 5000)">
                <TextInput id="divisor" name="volumetricDivisor" inputMode="numeric" defaultValue={setting.volumetricDivisor} />
              </FieldRow>
            </div>
            <FieldRow label="Drop-off instructions shown to sellers" htmlFor="dropoff">
              <TextArea id="dropoff" name="dropOffInstructions" rows={3} defaultValue={setting.dropOffInstructions ?? ""} placeholder="e.g. Write the parcel reference on the box. Drop-offs Mon–Sat before the cut-off." />
            </FieldRow>
            <div className="space-y-2 rounded-xl bg-umber-50 p-3">
              <p className="text-xs font-semibold tracking-wide text-umber-500 uppercase">Later phase</p>
              <Toggle name="cityHubs" label="City hubs: let domestic buyers choose one delivery" defaultChecked={setting.cityHubs} />
              <Toggle name="forwarders" label="Forwarders: weekly air cargo to a partner abroad, then local delivery" defaultChecked={setting.forwarders} />
              <p className="text-xs text-umber-500">Stored for planning; checkout and routing don&apos;t use these yet.</p>
            </div>
            <SubmitButton>Save rules</SubmitButton>
          </ActionForm>
        </Panel>

        <Panel title="Courier booking" description="How each courier is booked. Manual = book with the courier and type the tracking number (the link comes from the courier's template).">
          <ActionForm action={saveCourierAdaptersAction} inline className="space-y-3">
            {courierRows.length ? (
              courierRows.map((c) => (
                <FieldRow key={c.id} label={`${c.name}${c.isActive ? "" : " (inactive)"}`} htmlFor={`ad-${c.id}`}>
                  <SelectInput id={`ad-${c.id}`} name={`adapter_${c.id}`} defaultValue={setting.courierAdapters[c.id] ?? "manual"}>
                    {choices.map((a) => (
                      <option key={a.id} value={a.id} disabled={!a.implemented || (a.id === "sandbox" && !sandboxAllowed(process.env))}>
                        {a.label}
                      </option>
                    ))}
                  </SelectInput>
                </FieldRow>
              ))
            ) : (
              <p className="text-sm text-umber-500">
                Add couriers in <Link href="/admin/couriers" className="underline">Couriers & rate cards</Link> first.
              </p>
            )}
            <SubmitButton>Save booking methods</SubmitButton>
          </ActionForm>
        </Panel>
      </div>

      <Panel title="Courier API credentials" description="Server-side environment variables only — never stored in settings. Integrations are extension points until written against each courier's documentation (see src/lib/fulfilment/couriers/providers.ts).">
        <Table>
          <THead>
            <tr>
              <Th>Courier</Th>
              <Th>Scope</Th>
              <Th>Environment variables</Th>
              <Th>Integration</Th>
            </tr>
          </THead>
          <TBody>
            {COURIER_PROVIDERS.map((p) => {
              const st = providerCredentialStatus(p, process.env);
              return (
                <Tr key={p.id}>
                  <Td className="font-medium">{p.name}</Td>
                  <Td className="text-sm capitalize">{p.scope}</Td>
                  <Td className="text-xs">
                    {st.vars.map((v) => (
                      <span key={v.name} className="mr-2 inline-flex items-center gap-1">
                        <code>{v.name}</code> <Badge tone={v.set ? "success" : "neutral"}>{v.set ? "set" : "not set"}</Badge>
                      </span>
                    ))}
                  </Td>
                  <Td>
                    <Badge tone="pending">Not built yet — manual</Badge>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </Panel>

      <Panel title="Add a hub">
        <ActionForm action={createHubAction} inline resetOnSuccess className="space-y-4">
          <HubFields couriers={courierRows} idPrefix="new" />
          <SubmitButton>Add hub</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
