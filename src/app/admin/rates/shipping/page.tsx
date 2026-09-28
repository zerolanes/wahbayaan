import { asc } from "drizzle-orm";
import { addShippingBandAction, bulkShippingAction, deleteShippingRateAction, saveShippingRateAction } from "@/app/actions/admin/rates";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { FieldRow, SelectInput, TextInput } from "@/components/admin/controls";
import { EditRow } from "@/components/admin/edit-row";
import { ConfigBadge, CoverageBar, CoverageMatrix, RateAmount, RatesTabs, SourceCell } from "@/components/admin/rates";
import { Empty, FilterBar, FilterSelect, MiniStat, Panel, TableCard } from "@/components/admin/ui";
import { Notice, PageHeader, Pagination } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { shippingRates } from "@/lib/db/schema";
import { FREIGHT_THRESHOLD_G } from "@/lib/commerce/landed-cost";
import { minorToInput } from "@/lib/admin/money";
import { hrefWith, pageCount, pageOf, str } from "@/lib/admin/params";
import { bandKey, bandLabel, isQuotable, shippingCoverage, weightGaps } from "@/lib/admin/rate-coverage";
import { DESTINATIONS, destinationName } from "@/lib/money/currency";

export const metadata = { title: "Shipping rates" };

const SIZE = 50;
const CURRENCIES = ["PKR", "USD", "GBP", "CAD"] as const;

export default async function ShippingRatesPage(props: PageProps<"/admin/rates/shipping">) {
  const user = await requireStaff("rates.view");
  const canManage = user.permissions.has("rates.manage");
  const params = await props.searchParams;
  const page = pageOf(params);
  const d = await db();
  const all = await d.select().from(shippingRates).orderBy(asc(shippingRates.destinationCountry), asc(shippingRates.minWeightG), asc(shippingRates.courier));
  const destCodes = DESTINATIONS.map((x) => x.code);
  const cov = shippingCoverage(all, destCodes);
  const couriers = [...new Set(all.map((r) => r.courier))].sort();

  const f = { destination: str(params, "destination"), courier: str(params, "courier"), status: str(params, "status"), band: str(params, "band"), q: str(params, "q").toLowerCase() };
  const filtered = all.filter(
    (r) =>
      (!f.destination || r.destinationCountry === f.destination) &&
      (!f.courier || r.courier === f.courier) &&
      (!f.status || r.status === f.status) &&
      (!f.band || bandKey(r) === f.band) &&
      (!f.q || `${r.courier} ${r.serviceName ?? ""} ${r.notes ?? ""} ${r.source ?? ""}`.toLowerCase().includes(f.q)),
  );
  const rows = filtered.slice((page - 1) * SIZE, page * SIZE);
  const count = (s: string) => all.filter((r) => r.status === s).length;
  const blankActive = all.filter((r) => r.status === "active" && r.amount == null).length;
  const cols = canManage ? 8 : 7;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Cross-border" title="Shipping rates" description="Contracted courier rates by destination and parcel weight. A band without an active, entered amount is quoted to buyers as “Pending”." />
      <RatesTabs active="/admin/rates/shipping" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Active bands" value={String(count("active"))} hint={`of ${all.length} rows`} href={hrefWith("/admin/rates/shipping", {}, { status: "active" })} />
        <MiniStat label="Pending" value={String(count("pending"))} tone={count("pending") ? "pending" : undefined} hint="Need a contracted amount" href={hrefWith("/admin/rates/shipping", {}, { status: "pending" })} />
        <MiniStat label="Disabled" value={String(count("disabled"))} href={hrefWith("/admin/rates/shipping", {}, { status: "disabled" })} />
        <div data-slot="card" className="rounded-[var(--radius-card)] border border-umber-200 bg-white p-4">
          <CoverageBar n={cov.active} total={cov.total} label="Destination × weight bands quotable" />
          <p className="mt-2 text-xs text-umber-500">{couriers.length} couriers · above {FREIGHT_THRESHOLD_G / 1000} kg ships as quoted freight</p>
        </div>
      </div>

      {blankActive ? <Notice tone="danger" title="Active rows without an amount">{blankActive} active row(s) have no amount and are ignored when quoting. Enter the amount or set them back to pending.</Notice> : null}

      <CoverageMatrix
        title="Coverage — destination × weight band"
        rows={DESTINATIONS.map((x) => ({ key: x.code, label: x.name }))}
        columns={cov.bands.map((b) => ({ key: bandKey(b), label: bandLabel(b) }))}
        cell={(dest, band) => {
          const c = cov.cells.find((x) => x.destination === dest && bandKey(x.band) === band)!;
          return { state: c.state, detail: c.totalCouriers ? `${c.activeCouriers}/${c.totalCouriers} couriers` : undefined, href: hrefWith("/admin/rates/shipping", {}, { destination: dest, band }) };
        }}
        footer={
          <ul className="space-y-0.5">
            {DESTINATIONS.map((x) => {
              const gaps = weightGaps(all, x.code, FREIGHT_THRESHOLD_G);
              return (
                <li key={x.code}>
                  <span className="font-medium text-umber-700">{x.name}:</span>{" "}
                  {gaps.length ? `no quotable rate for ${gaps.map(bandLabel).join(", ")}` : `every parcel up to ${FREIGHT_THRESHOLD_G / 1000} kg can be quoted`}
                </li>
              );
            })}
          </ul>
        }
      />

      <FilterBar action="/admin/rates/shipping" q={str(params, "q")} placeholder="Courier, service, notes">
        <FilterSelect name="destination" label="Destination" value={f.destination} options={DESTINATIONS.map((x) => ({ value: x.code, label: x.name }))} />
        <FilterSelect name="courier" label="Courier" value={f.courier} options={couriers.map((c) => ({ value: c, label: c }))} />
        <FilterSelect name="band" label="Weight" value={f.band} options={cov.bands.map((b) => ({ value: bandKey(b), label: bandLabel(b) }))} />
        <FilterSelect name="status" label="Status" value={f.status} options={["pending", "active", "disabled"].map((s) => ({ value: s, label: s }))} />
      </FilterBar>

      <TableCard
        toolbar={
          <>
            <p className="text-sm text-umber-600">
              {filtered.length} row{filtered.length === 1 ? "" : "s"}
            </p>
            {canManage ? (
              <BulkBar
                formId="shipping-bulk"
                action={bulkShippingAction}
                options={[
                  { value: "active", label: "Activate (rows with an amount)", confirm: "Activate the selected bands? Buyers will be charged these amounts." },
                  { value: "pending", label: "Set back to pending" },
                  { value: "disabled", label: "Disable" },
                ]}
              />
            ) : null}
          </>
        }
        footer={pageCount(filtered.length, SIZE) > 1 ? <Pagination page={page} pageCount={pageCount(filtered.length, SIZE)} hrefFor={(p) => hrefWith("/admin/rates/shipping", params, { page: p })} /> : undefined}
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                {canManage ? (
                  <Th className="w-8">
                    <SelectAll formId="shipping-bulk" />
                  </Th>
                ) : null}
                <Th>Courier</Th>
                <Th>Destination</Th>
                <Th>Weight band</Th>
                <Th className="text-right">Amount</Th>
                <Th>Transit</Th>
                <Th>Status</Th>
                <Th>Last updated / source</Th>
                {canManage ? <Th /> : null}
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const cells = (
                  <>
                    {canManage ? (
                      <Td>
                        <RowCheck formId="shipping-bulk" value={r.id} label={`Select ${r.courier} ${r.destinationCountry} ${bandLabel(r)}`} />
                      </Td>
                    ) : null}
                    <Td>
                      <p className="font-medium text-umber-900">{r.courier}</p>
                      {r.serviceName ? <p className="text-xs text-umber-500">{r.serviceName}</p> : null}
                    </Td>
                    <Td>{destinationName(r.destinationCountry)}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{bandLabel(r)}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <RateAmount amount={r.amount} currency={r.currency} />
                    </Td>
                    <Td className="whitespace-nowrap text-umber-600">{r.transitDaysMin != null || r.transitDaysMax != null ? `${r.transitDaysMin ?? "?"}–${r.transitDaysMax ?? "?"} days` : "—"}</Td>
                    <Td>
                      <ConfigBadge status={r.status} />
                      {r.status === "active" && !isQuotable(r) ? <p className="mt-0.5 text-xs text-danger-700">No amount — ignored</p> : null}
                    </Td>
                    <Td>
                      <SourceCell source={r.source ?? r.notes} updatedAt={r.updatedAt} />
                    </Td>
                  </>
                );
                if (!canManage) return <tr key={r.id}>{cells}</tr>;
                return (
                  <EditRow
                    key={r.id}
                    colSpan={cols}
                    cells={cells}
                    editor={
                      <div className="space-y-3">
                        <ActionForm action={saveShippingRateAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                          <input type="hidden" name="id" value={r.id} />
                          <FieldRow label="Service name" className="lg:col-span-2">
                            <TextInput name="serviceName" defaultValue={r.serviceName ?? ""} placeholder="e.g. Express Worldwide" />
                          </FieldRow>
                          <FieldRow label="Amount" hint="Leave empty while pending">
                            <TextInput name="amount" inputMode="decimal" defaultValue={minorToInput(r.amount)} placeholder="Pending" />
                          </FieldRow>
                          <FieldRow label="Currency">
                            <SelectInput name="currency" defaultValue={r.currency}>
                              {CURRENCIES.map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </SelectInput>
                          </FieldRow>
                          <FieldRow label="Transit days (min–max)">
                            <div className="flex gap-1.5">
                              <TextInput name="transitDaysMin" inputMode="numeric" defaultValue={r.transitDaysMin ?? ""} aria-label="Minimum transit days" />
                              <TextInput name="transitDaysMax" inputMode="numeric" defaultValue={r.transitDaysMax ?? ""} aria-label="Maximum transit days" />
                            </div>
                          </FieldRow>
                          <FieldRow label="Status">
                            <SelectInput name="status" defaultValue={r.status}>
                              <option value="pending">Pending</option>
                              <option value="active">Active</option>
                              <option value="disabled">Disabled</option>
                            </SelectInput>
                          </FieldRow>
                          <FieldRow label="Source" hint="Contract / rate card reference" className="lg:col-span-3">
                            <TextInput name="source" defaultValue={r.source ?? ""} placeholder="e.g. DHL rate card 2026-Q3, account 12345" />
                          </FieldRow>
                          <FieldRow label="Notes" className="lg:col-span-3">
                            <TextInput name="notes" defaultValue={r.notes ?? ""} />
                          </FieldRow>
                          <div className="flex items-end gap-2 lg:col-span-6">
                            <SubmitButton>Save band</SubmitButton>
                          </div>
                        </ActionForm>
                        <ActionButton action={deleteShippingRateAction} fields={{ id: r.id }} variant="ghost" confirm={`Delete the ${r.courier} ${bandLabel(r)} band to ${destinationName(r.destinationCountry)}?`}>
                          Delete band
                        </ActionButton>
                      </div>
                    }
                  />
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>{all.length ? "No rates match these filters." : "No shipping bands yet. Add the first one below."}</Empty>
        )}
      </TableCard>

      {canManage ? (
        <Panel title="Add a weight band" description="New bands start as pending; activate once the contracted amount is confirmed.">
          <ActionForm action={addShippingBandAction} resetOnSuccess className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <FieldRow label="Courier" className="lg:col-span-2">
              <TextInput name="courier" list="courier-list" required placeholder="DHL Express" />
              <datalist id="courier-list">
                {couriers.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </FieldRow>
            <FieldRow label="Destination">
              <SelectInput name="destinationCountry">
                {DESTINATIONS.map((x) => (
                  <option key={x.code} value={x.code}>
                    {x.name}
                  </option>
                ))}
              </SelectInput>
            </FieldRow>
            <FieldRow label="Min kg">
              <TextInput name="minKg" inputMode="decimal" required placeholder="0" />
            </FieldRow>
            <FieldRow label="Max kg">
              <TextInput name="maxKg" inputMode="decimal" required placeholder="2" />
            </FieldRow>
            <FieldRow label="Currency">
              <SelectInput name="currency" defaultValue="PKR">
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </SelectInput>
            </FieldRow>
            <FieldRow label="Amount (optional)">
              <TextInput name="amount" inputMode="decimal" placeholder="Pending" />
            </FieldRow>
            <div className="lg:col-span-7">
              <SubmitButton>Add band</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      ) : null}
    </div>
  );
}
