import { asc } from "drizzle-orm";
import { addDutyRateAction, bulkDutyAction, deleteDutyRateAction, saveDutyRateAction } from "@/app/actions/admin/rates";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { FieldRow, SelectInput, TextInput } from "@/components/admin/controls";
import { EditRow } from "@/components/admin/edit-row";
import { ConfigBadge, CoverageBar, CoverageMatrix, Percent, RateAmount, RatesTabs, SourceCell } from "@/components/admin/rates";
import { Empty, FilterBar, FilterSelect, MiniStat, Panel, TableCard } from "@/components/admin/ui";
import { Notice, PageHeader, Pagination } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { categories, dutyRates } from "@/lib/db/schema";
import { minorToInput } from "@/lib/admin/money";
import { hrefWith, pageCount, pageOf, str } from "@/lib/admin/params";
import { dutyCoverage } from "@/lib/admin/rate-coverage";
import { DESTINATIONS, destinationName } from "@/lib/money/currency";

export const metadata = { title: "Duty & import tax" };

const SIZE = 50;

export default async function DutyRatesPage(props: PageProps<"/admin/rates/duty">) {
  const user = await requireStaff("rates.view");
  const canManage = user.permissions.has("rates.manage");
  const params = await props.searchParams;
  const page = pageOf(params);
  const d = await db();
  const [all, cats] = await Promise.all([
    d.select().from(dutyRates).orderBy(asc(dutyRates.destinationCountry)),
    d.select({ id: categories.id, name: categories.name, hsCode: categories.hsCode, sort: categories.sort }).from(categories).orderBy(asc(categories.sort), asc(categories.name)),
  ]);
  const catName = (id: string | null) => (id ? (cats.find((c) => c.id === id)?.name ?? "Unknown category") : "All categories");
  const cov = dutyCoverage(all, DESTINATIONS.map((x) => x.code), cats.map((c) => c.id));

  const f = { destination: str(params, "destination"), category: str(params, "category"), status: str(params, "status"), q: str(params, "q").toLowerCase() };
  const filtered = all
    .filter(
      (r) =>
        (!f.destination || r.destinationCountry === f.destination) &&
        (!f.category || (f.category === "all" ? r.categoryId == null : r.categoryId === f.category)) &&
        (!f.status || r.status === f.status) &&
        (!f.q || `${r.hsCode ?? ""} ${r.taxLabel ?? ""} ${r.source ?? ""} ${r.notes ?? ""} ${catName(r.categoryId)}`.toLowerCase().includes(f.q)),
    )
    .sort((a, b) => a.destinationCountry.localeCompare(b.destinationCountry) || catName(a.categoryId).localeCompare(catName(b.categoryId)));
  const rows = filtered.slice((page - 1) * SIZE, page * SIZE);
  const count = (s: string) => all.filter((r) => r.status === s).length;
  const cols = canManage ? 8 : 7;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cross-border"
        title="Duty & import tax"
        description="Import duty and tax (VAT/GST/sales tax) per destination and craft. Confirm every row with a customs broker — a pending row is shown to buyers as “Pending”, never as zero."
      />
      <RatesTabs active="/admin/rates/duty" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Active rows" value={String(count("active"))} hint={`of ${all.length}`} href={hrefWith("/admin/rates/duty", {}, { status: "active" })} />
        <MiniStat label="Pending" value={String(count("pending"))} tone={count("pending") ? "pending" : undefined} hint="Awaiting broker confirmation" href={hrefWith("/admin/rates/duty", {}, { status: "pending" })} />
        <MiniStat label="Categories without an HS code" value={String(cats.filter((c) => !c.hsCode).length)} hint="Set on Marketplace → Categories" href="/admin/categories" />
        <div data-slot="card" className="rounded-[var(--radius-card)] border border-umber-200 bg-white p-4">
          <CoverageBar n={cov.active} total={cov.total} label="Destination × craft confirmed" />
          <p className="mt-2 text-xs text-umber-500">Listings with an HS override match rows by HS code first.</p>
        </div>
      </div>

      <CoverageMatrix
        title="Coverage — destination × craft"
        rows={DESTINATIONS.map((x) => ({ key: x.code, label: x.name }))}
        columns={cats.map((c) => ({ key: c.id, label: c.name }))}
        cell={(dest, cat) => {
          const c = cov.cells.find((x) => x.destination === dest && x.categoryId === cat)!;
          return { state: c.state, detail: c.via === "country" ? "Country-wide" : undefined, href: hrefWith("/admin/rates/duty", {}, { destination: dest, category: cat }) };
        }}
      />

      <FilterBar action="/admin/rates/duty" q={str(params, "q")} placeholder="HS code, tax label, source">
        <FilterSelect name="destination" label="Destination" value={f.destination} options={DESTINATIONS.map((x) => ({ value: x.code, label: x.name }))} />
        <FilterSelect name="category" label="Craft" value={f.category} options={[{ value: "all", label: "All categories (country-wide)" }, ...cats.map((c) => ({ value: c.id, label: c.name }))]} />
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
                formId="duty-bulk"
                action={bulkDutyAction}
                options={[
                  { value: "active", label: "Activate (rows with duty % and source)", confirm: "Activate the selected duty rows? Buyers will be charged on them." },
                  { value: "pending", label: "Set back to pending" },
                  { value: "disabled", label: "Disable" },
                ]}
              />
            ) : null}
          </>
        }
        footer={pageCount(filtered.length, SIZE) > 1 ? <Pagination page={page} pageCount={pageCount(filtered.length, SIZE)} hrefFor={(p) => hrefWith("/admin/rates/duty", params, { page: p })} /> : undefined}
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                {canManage ? (
                  <Th className="w-8">
                    <SelectAll formId="duty-bulk" />
                  </Th>
                ) : null}
                <Th>Destination · craft</Th>
                <Th>HS code</Th>
                <Th className="text-right">Duty</Th>
                <Th className="text-right">Tax</Th>
                <Th>Duty-free under</Th>
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
                        <RowCheck formId="duty-bulk" value={r.id} />
                      </Td>
                    ) : null}
                    <Td>
                      <p className="font-medium text-umber-900">{destinationName(r.destinationCountry)}</p>
                      <p className="text-xs text-umber-500">
                        {catName(r.categoryId)} · {r.basis === "item" ? "on item value" : "on item + shipping"}
                      </p>
                    </Td>
                    <Td>{r.hsCode ? <code className="text-xs">{r.hsCode}</code> : <span className="text-xs text-umber-400">Category default</span>}</Td>
                    <Td className="text-right">
                      <Percent value={r.dutyPercent} />
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      {r.taxPercent == null ? (
                        <Percent value={null} />
                      ) : (
                        <>
                          <Percent value={r.taxPercent} /> <span className="text-xs text-umber-500">{r.taxLabel}</span>
                        </>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{r.deMinimisAmount != null && r.deMinimisCurrency ? <RateAmount amount={r.deMinimisAmount} currency={r.deMinimisCurrency} /> : <span className="text-xs text-umber-400">No threshold</span>}</Td>
                    <Td>
                      <ConfigBadge status={r.status} />
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
                        <ActionForm action={saveDutyRateAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                          <input type="hidden" name="id" value={r.id} />
                          <FieldRow label="HS code" hint="Empty = applies to the whole category">
                            <TextInput name="hsCode" defaultValue={r.hsCode ?? ""} placeholder="5701.10" />
                          </FieldRow>
                          <FieldRow label="Duty %" hint="0 if duty-free">
                            <TextInput name="dutyPercent" inputMode="decimal" defaultValue={r.dutyPercent ?? ""} placeholder="Pending" />
                          </FieldRow>
                          <FieldRow label="Tax %">
                            <TextInput name="taxPercent" inputMode="decimal" defaultValue={r.taxPercent ?? ""} placeholder="Pending" />
                          </FieldRow>
                          <FieldRow label="Tax label">
                            <TextInput name="taxLabel" defaultValue={r.taxLabel ?? ""} placeholder="VAT / GST / Sales tax" />
                          </FieldRow>
                          <FieldRow label="Duty-free threshold">
                            <div className="flex gap-1.5">
                              <TextInput name="deMinimisAmount" inputMode="decimal" defaultValue={minorToInput(r.deMinimisAmount)} placeholder="None" />
                              <SelectInput name="deMinimisCurrency" defaultValue={r.deMinimisCurrency ?? ""} aria-label="Threshold currency" className="w-24">
                                <option value="">—</option>
                                {["USD", "GBP", "CAD", "PKR"].map((c) => (
                                  <option key={c}>{c}</option>
                                ))}
                              </SelectInput>
                            </div>
                          </FieldRow>
                          <FieldRow label="Charged on">
                            <SelectInput name="basis" defaultValue={r.basis}>
                              <option value="item_plus_shipping">Item + shipping</option>
                              <option value="item">Item value only</option>
                            </SelectInput>
                          </FieldRow>
                          <FieldRow label="Status">
                            <SelectInput name="status" defaultValue={r.status}>
                              <option value="pending">Pending</option>
                              <option value="active">Active</option>
                              <option value="disabled">Disabled</option>
                            </SelectInput>
                          </FieldRow>
                          <FieldRow label="Source" hint="Required to activate: broker name, tariff reference" className="lg:col-span-3">
                            <TextInput name="source" defaultValue={r.source ?? ""} />
                          </FieldRow>
                          <FieldRow label="Notes" className="lg:col-span-2">
                            <TextInput name="notes" defaultValue={r.notes ?? ""} />
                          </FieldRow>
                          <div className="lg:col-span-6">
                            <SubmitButton>Save duty row</SubmitButton>
                          </div>
                        </ActionForm>
                        <ActionButton action={deleteDutyRateAction} fields={{ id: r.id }} variant="ghost" confirm="Delete this duty row?">
                          Delete row
                        </ActionButton>
                      </div>
                    }
                  />
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>{all.length ? "No duty rows match these filters." : "No duty rows yet."}</Empty>
        )}
      </TableCard>

      {canManage ? (
        <Panel title="Add a duty row" description="Add a country-wide default, a craft-specific row, or an HS-code row for listings that override their category's code.">
          <ActionForm action={addDutyRateAction} resetOnSuccess className="flex flex-wrap items-end gap-3">
            <FieldRow label="Destination">
              <SelectInput name="destinationCountry" className="w-44">
                {DESTINATIONS.map((x) => (
                  <option key={x.code} value={x.code}>
                    {x.name}
                  </option>
                ))}
              </SelectInput>
            </FieldRow>
            <FieldRow label="Craft">
              <SelectInput name="categoryId" className="w-56">
                <option value="">All categories (country-wide)</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectInput>
            </FieldRow>
            <FieldRow label="HS code (optional)">
              <TextInput name="hsCode" placeholder="5701.10" className="w-36" />
            </FieldRow>
            <SubmitButton>Add row</SubmitButton>
          </ActionForm>
          <Notice tone="indigo" className="mt-4">
            Rates are matched in this order: HS code → craft → country-wide. Disabled rows are skipped.
          </Notice>
        </Panel>
      ) : null}
    </div>
  );
}
