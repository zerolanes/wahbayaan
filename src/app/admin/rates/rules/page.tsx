import { asc, desc } from "drizzle-orm";
import { bulkImportRulesAction, deleteImportRuleAction, saveImportRuleAction } from "@/app/actions/admin/rates";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { FieldRow, SelectInput, TextArea, TextInput } from "@/components/admin/controls";
import { EditRow } from "@/components/admin/edit-row";
import { ConfigBadge, CoverageBar, CoverageMatrix, RatesTabs, SourceCell } from "@/components/admin/rates";
import { Empty, FilterBar, FilterSelect, MiniStat, Panel, StatusBadge, TableCard } from "@/components/admin/ui";
import { PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { categories, importRules } from "@/lib/db/schema";
import { str } from "@/lib/admin/params";
import { ruleCoverage } from "@/lib/admin/rate-coverage";
import { DESTINATIONS, destinationName } from "@/lib/money/currency";

export const metadata = { title: "Import rules" };

const LEVELS = [
  { value: "info", label: "Info — shown as a note" },
  { value: "warning", label: "Warning — buyer should know before ordering" },
  { value: "restricted", label: "Restricted — needs a permit or declaration" },
  { value: "prohibited", label: "Prohibited — cannot be shipped there" },
] as const;

type Cat = { id: string; name: string };
type Rule = typeof importRules.$inferSelect;

function RuleFields({ r, cats }: { r?: Rule; cats: Cat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <FieldRow label="Destination">
        <SelectInput name="destinationCountry" defaultValue={r?.destinationCountry ?? "US"}>
          {DESTINATIONS.map((x) => (
            <option key={x.code} value={x.code}>
              {x.name}
            </option>
          ))}
        </SelectInput>
      </FieldRow>
      <FieldRow label="Craft">
        <SelectInput name="categoryId" defaultValue={r?.categoryId ?? ""}>
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectInput>
      </FieldRow>
      <FieldRow label="Level">
        <SelectInput name="level" defaultValue={r?.level ?? "info"}>
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </SelectInput>
      </FieldRow>
      <FieldRow label="Status">
        <SelectInput name="status" defaultValue={r?.status ?? "pending"}>
          <option value="pending">Pending (not shown)</option>
          <option value="active">Active (shown to buyers)</option>
          <option value="disabled">Disabled</option>
        </SelectInput>
      </FieldRow>
      <FieldRow label="Message shown to buyers" className="sm:col-span-2 lg:col-span-4">
        <TextArea name="message" defaultValue={r?.message ?? ""} rows={2} required placeholder="e.g. Antique carpets over 100 years old need a CITES-free declaration." />
      </FieldRow>
      <FieldRow label="Source" hint="Regulation, agency page or broker advice" className="sm:col-span-2 lg:col-span-4">
        <TextInput name="source" defaultValue={r?.source ?? ""} />
      </FieldRow>
    </div>
  );
}

export default async function ImportRulesPage(props: PageProps<"/admin/rates/rules">) {
  const user = await requireStaff("rates.view");
  const canManage = user.permissions.has("rates.manage");
  const params = await props.searchParams;
  const d = await db();
  const [all, cats] = await Promise.all([
    d.select().from(importRules).orderBy(asc(importRules.destinationCountry), desc(importRules.updatedAt)),
    d.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sort), asc(categories.name)),
  ]);
  const catName = (id: string | null) => (id ? (cats.find((c) => c.id === id)?.name ?? "Unknown") : "All categories");
  const cov = ruleCoverage(all, DESTINATIONS.map((x) => x.code), cats.map((c) => c.id));
  const f = { destination: str(params, "destination"), category: str(params, "category"), status: str(params, "status"), level: str(params, "level"), q: str(params, "q").toLowerCase() };
  const rows = all.filter(
    (r) =>
      (!f.destination || r.destinationCountry === f.destination) &&
      (!f.category || r.categoryId === f.category || r.categoryId == null) /* a craft also sees country-wide rules */ &&
      (!f.status || r.status === f.status) &&
      (!f.level || r.level === f.level) &&
      (!f.q || `${r.message} ${r.source ?? ""}`.toLowerCase().includes(f.q)),
  );
  const count = (s: string) => all.filter((r) => r.status === s).length;
  const cols = canManage ? 6 : 5;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cross-border"
        title="Import rules"
        description="Restrictions and notices shown on product pages and at checkout for a destination and craft. Where no active rule exists, buyers see “not yet reviewed”."
      />
      <RatesTabs active="/admin/rates/rules" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Active rules" value={String(count("active"))} hint={`of ${all.length}`} />
        <MiniStat label="Pending" value={String(count("pending"))} tone={count("pending") ? "pending" : undefined} hint="Drafted, not shown to buyers" />
        <MiniStat label="Prohibited / restricted" value={String(all.filter((r) => r.status === "active" && (r.level === "prohibited" || r.level === "restricted")).length)} hint="Active" />
        <div data-slot="card" className="rounded-[var(--radius-card)] border border-umber-200 bg-white p-4">
          <CoverageBar n={cov.reviewed} total={cov.total} label="Destination × craft reviewed" />
        </div>
      </div>

      <CoverageMatrix
        title="Review coverage — destination × craft"
        rows={DESTINATIONS.map((x) => ({ key: x.code, label: x.name }))}
        columns={cats.map((c) => ({ key: c.id, label: c.name }))}
        cell={(dest, cat) => {
          const c = cov.cells.find((x) => x.destination === dest && x.categoryId === cat)!;
          return { state: c.reviewed ? "active" : "pending", detail: c.reviewed ? `${c.rules} rule${c.rules === 1 ? "" : "s"}${c.worst === "prohibited" || c.worst === "restricted" ? ` · ${c.worst}` : ""}` : "Not reviewed", href: `/admin/rates/rules?destination=${dest}&category=${cat}` };
        }}
        footer="A cell counts as reviewed once an active rule covers it — add an “info” rule such as “No special restrictions” when a broker confirms there are none."
      />

      <FilterBar action="/admin/rates/rules" q={str(params, "q")} placeholder="Message or source">
        <FilterSelect name="destination" label="Destination" value={f.destination} options={DESTINATIONS.map((x) => ({ value: x.code, label: x.name }))} />
        <FilterSelect name="category" label="Craft" value={f.category} options={[{ value: "all", label: "All categories only" }, ...cats.map((c) => ({ value: c.id, label: c.name }))]} />
        <FilterSelect name="level" label="Level" value={f.level} options={LEVELS.map((l) => ({ value: l.value, label: l.value }))} />
        <FilterSelect name="status" label="Status" value={f.status} options={["pending", "active", "disabled"].map((s) => ({ value: s, label: s }))} />
      </FilterBar>

      <TableCard
        toolbar={
          <>
            <p className="text-sm text-umber-600">
              {rows.length} rule{rows.length === 1 ? "" : "s"}
            </p>
            {canManage ? (
              <BulkBar
                formId="rules-bulk"
                action={bulkImportRulesAction}
                options={[
                  { value: "active", label: "Activate (show to buyers)", confirm: "Show the selected rules to buyers?" },
                  { value: "pending", label: "Set back to pending" },
                  { value: "disabled", label: "Disable" },
                ]}
              />
            ) : null}
          </>
        }
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                {canManage ? (
                  <Th className="w-8">
                    <SelectAll formId="rules-bulk" />
                  </Th>
                ) : null}
                <Th>Destination · craft</Th>
                <Th>Level</Th>
                <Th>Message</Th>
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
                      <td className="px-4 py-3">
                        <RowCheck formId="rules-bulk" value={r.id} />
                      </td>
                    ) : null}
                    <Td className="whitespace-nowrap">
                      <p className="font-medium text-umber-900">{destinationName(r.destinationCountry)}</p>
                      <p className="text-xs text-umber-500">{catName(r.categoryId)}</p>
                    </Td>
                    <Td>
                      <StatusBadge kind="rule" status={r.level} />
                    </Td>
                    <Td className="max-w-md text-umber-700">{r.message}</Td>
                    <Td>
                      <ConfigBadge status={r.status} />
                    </Td>
                    <Td>
                      <SourceCell source={r.source} updatedAt={r.updatedAt} />
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
                        <ActionForm action={saveImportRuleAction} className="space-y-3">
                          <input type="hidden" name="id" value={r.id} />
                          <RuleFields r={r} cats={cats} />
                          <SubmitButton>Save rule</SubmitButton>
                        </ActionForm>
                        <ActionButton action={deleteImportRuleAction} fields={{ id: r.id }} variant="ghost" confirm="Delete this import rule?">
                          Delete rule
                        </ActionButton>
                      </div>
                    }
                  />
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>{all.length ? "No rules match these filters." : "No import rules yet. Every destination × craft currently shows “not yet reviewed” to buyers."}</Empty>
        )}
      </TableCard>

      {canManage ? (
        <Panel title="Add an import rule" description="Rules start pending; buyers only see active rules.">
          <ActionForm action={saveImportRuleAction} resetOnSuccess className="space-y-3">
            <RuleFields cats={cats} />
            <SubmitButton>Add rule</SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}
    </div>
  );
}
