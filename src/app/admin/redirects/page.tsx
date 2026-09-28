import { desc } from "drizzle-orm";
import { ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import { deleteRedirectsAction, resetRedirectHitsAction, saveRedirectAction } from "@/app/actions/admin/redirects";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { FieldRow, TextInput, Toggle } from "@/components/admin/controls";
import { EditRow } from "@/components/admin/edit-row";
import { Empty, FilterBar, FilterSelect, MiniStat, Panel, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader, Pagination } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { redirects } from "@/lib/db/schema";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { chainedRules, isExternal, normalizePath, resolveRedirect } from "@/lib/admin/redirects";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Redirects" };

type Row = typeof redirects.$inferSelect;

function RedirectFields({ r }: { r?: Row }) {
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <FieldRow label="From path" hint="The old URL path, e.g. /shop/rugs-old">
        <TextInput name="fromPath" defaultValue={r?.fromPath} required placeholder="/old-path" />
      </FieldRow>
      <FieldRow label="To" hint="A path on this site or a full https:// URL">
        <TextInput name="toPath" defaultValue={r?.toPath} required placeholder="/category/rugs" />
      </FieldRow>
      <Toggle name="permanent" label="Permanent (301)" defaultChecked={r?.permanent ?? true} className="h-9" />
    </div>
  );
}

export default async function RedirectsPage(props: PageProps<"/admin/redirects">) {
  await requireStaff("settings.manage");
  const params = await props.searchParams;
  const page = pageOf(params);
  const d = await db();
  const all = await d.select().from(redirects).orderBy(desc(redirects.hits), desc(redirects.createdAt));
  const chained = new Set(chainedRules(all).map((r) => r.id));
  const q = str(params, "q").toLowerCase();
  const kind = str(params, "kind");
  const filtered = all.filter(
    (r) =>
      (!q || `${r.fromPath} ${r.toPath}`.toLowerCase().includes(q)) &&
      (!kind || (kind === "unused" ? r.hits === 0 : kind === "chained" ? chained.has(r.id) : kind === "external" ? isExternal(r.toPath) : kind === "temporary" ? !r.permanent : true)),
  );
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const test = str(params, "test");
  const res = test ? resolveRedirect(test, all) : null;
  const totalHits = all.reduce((a, r) => a + r.hits, 0);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Content" title="Redirects" description="Send old or mistyped URLs to the right page. Rules apply only when the requested path would otherwise be a 404." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Rules" value={String(all.length)} hint={`${all.filter((r) => !r.permanent).length} temporary`} />
        <MiniStat label="Hits" value={totalHits.toLocaleString("en-US")} hint="Since each rule was created or reset" />
        <MiniStat label="Never used" value={String(all.filter((r) => r.hits === 0).length)} href={hrefWith("/admin/redirects", {}, { kind: "unused" })} />
        <MiniStat label="Chained" value={String(chained.size)} tone={chained.size ? "pending" : undefined} hint="Destination is itself redirected" href={hrefWith("/admin/redirects", {}, { kind: "chained" })} />
      </div>

      <Panel title="Test a path" description="See what a visitor to a missing path would be sent to.">
        <form method="get" action="/admin/redirects" className="flex flex-wrap items-center gap-2">
          <TextInput name="test" defaultValue={test} placeholder="/old-path or https://wahbayaan.com/old-path" className="max-w-md" />
          <button className="h-9 rounded-lg bg-umber-900 px-3.5 text-sm font-medium text-white hover:bg-umber-800">Test</button>
        </form>
        {res ? (
          <div className="mt-4 rounded-lg border border-umber-200 bg-umber-50 p-4 text-sm">
            {!res.matched ? (
              <p className="flex items-center gap-2 text-umber-700">
                <CircleAlert className="size-4 text-umber-400" /> No rule matches <code>{normalizePath(test)}</code>. If no page exists there, the visitor sees the 404 page.
              </p>
            ) : res.loop ? (
              <p className="flex items-center gap-2 text-danger-700">
                <CircleAlert className="size-4" /> Redirect loop — fix one of these rules.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-success-700">
                <CircleCheck className="size-4" /> Visitors end up at <code className="font-medium">{res.final}</code>
                {res.hops.length > 1 ? ` after ${res.hops.length} hops — consider pointing the first rule straight there.` : "."}
              </p>
            )}
            {res.hops.length ? (
              <ol className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <li>
                  <code>{normalizePath(test)}</code>
                </li>
                {res.hops.map((h, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <ArrowRight className="size-3 text-umber-400" />
                    <code>{h.toPath}</code>
                    <Badge tone="neutral">{h.permanent ? "301" : "302"}</Badge>
                  </li>
                ))}
              </ol>
            ) : null}
            <p className="mt-3 text-xs text-umber-500">Paths are matched exactly (case-sensitive) after removing a trailing slash, query string and fragment. A rule never overrides a page that exists.</p>
          </div>
        ) : null}
      </Panel>

      <FilterBar action="/admin/redirects" q={str(params, "q")} placeholder="From or to path">
        <FilterSelect name="kind" label="Show" value={kind} options={[{ value: "unused", label: "Never used" }, { value: "chained", label: "Chained" }, { value: "external", label: "External" }, { value: "temporary", label: "Temporary (302)" }]} />
      </FilterBar>

      <TableCard
        toolbar={
          <>
            <p className="text-sm text-umber-600">
              {filtered.length} redirect{filtered.length === 1 ? "" : "s"}
            </p>
            <BulkBar formId="redirects-bulk" action={deleteRedirectsAction} options={[{ value: "delete", label: "Delete", confirm: "Delete the selected redirects?" }]} />
          </>
        }
        footer={pageCount(filtered.length) > 1 ? <Pagination page={page} pageCount={pageCount(filtered.length)} hrefFor={(p) => hrefWith("/admin/redirects", params, { page: p })} /> : undefined}
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th className="w-8">
                  <SelectAll formId="redirects-bulk" />
                </Th>
                <Th>From</Th>
                <Th>To</Th>
                <Th>Type</Th>
                <Th className="text-right">Hits</Th>
                <Th>Added</Th>
                <Th />
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <EditRow
                  key={r.id}
                  colSpan={6}
                  cells={
                    <>
                      <Td>
                        <RowCheck formId="redirects-bulk" value={r.id} />
                      </Td>
                      <Td>
                        <code className="text-xs text-umber-900">{r.fromPath}</code>
                      </Td>
                      <Td>
                        <code className="text-xs text-umber-700">{r.toPath}</code>
                        {chained.has(r.id) ? <p className="text-xs text-pending-600">Destination is redirected again</p> : null}
                        {isExternal(r.toPath) ? <p className="text-xs text-umber-500">External site</p> : null}
                      </Td>
                      <Td>
                        <Badge tone={r.permanent ? "neutral" : "warning"}>{r.permanent ? "301 permanent" : "302 temporary"}</Badge>
                      </Td>
                      <Td className="text-right tabular-nums">{r.hits.toLocaleString("en-US")}</Td>
                      <Td className="text-xs whitespace-nowrap text-umber-500">{formatDate(r.createdAt)}</Td>
                    </>
                  }
                  editor={
                    <div className="space-y-3">
                      <ActionForm action={saveRedirectAction} className="space-y-3">
                        <input type="hidden" name="id" value={r.id} />
                        <RedirectFields r={r} />
                        <SubmitButton>Save redirect</SubmitButton>
                      </ActionForm>
                      <div className="flex gap-2">
                        {r.hits ? (
                          <ActionButton action={resetRedirectHitsAction} fields={{ id: r.id }} variant="ghost">
                            Reset hits
                          </ActionButton>
                        ) : null}
                        <ActionButton action={deleteRedirectsAction} fields={{ "ids[]": r.id }} variant="ghost" confirm={`Delete the redirect from ${r.fromPath}?`}>
                          Delete
                        </ActionButton>
                      </div>
                    </div>
                  }
                />
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>{all.length ? "No redirects match these filters." : "No redirects yet. Add one below when a listing, artisan or page URL changes."}</Empty>
        )}
      </TableCard>

      <Panel title="Add a redirect">
        <ActionForm action={saveRedirectAction} resetOnSuccess className="space-y-3">
          <RedirectFields />
          <SubmitButton>Add redirect</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
