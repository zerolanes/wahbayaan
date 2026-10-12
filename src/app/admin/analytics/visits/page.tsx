import Link from "next/link";
import { AnalyticsTabs, flag, placeLabel } from "@/components/admin/analytics";
import { Empty, ExportLink, FilterBar, FilterDate, FilterSelect, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader, Pagination } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { hrefWith, pageCount, str } from "@/lib/admin/params";
import { listVisits } from "@/lib/analytics/stats";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Visitor journeys" };

function duration(a: Date, b: Date) {
  const s = Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default async function VisitsPage(props: PageProps<"/admin/analytics/visits">) {
  await requireStaff("analytics.view");
  const params = await props.searchParams;
  const { rows, total, page } = await listVisits(params);
  const qs = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && v && k !== "page" ? [[k, v]] : []))).toString();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Insights" title="Visitor journeys" description="Each visit (30 minutes of activity) with its landing page, source and location. Open one to see its page-by-page timeline." />
      <AnalyticsTabs active="/admin/analytics/visits" />
      <TableCard
        toolbar={
          <FilterBar
            action="/admin/analytics/visits"
            q={str(params, "q")}
            placeholder="Consent id, page, city or country…"
            extra={
              <>
                <ExportLink href={`/admin/export/analytics?type=visits${qs ? `&${qs}` : ""}`}>Visits CSV</ExportLink>
                <ExportLink href={`/admin/export/analytics?type=pageviews${qs ? `&${qs}` : ""}`}>Page views CSV</ExportLink>
              </>
            }
          >
            <FilterSelect name="device" label="Device" value={str(params, "device")} options={["desktop", "mobile", "tablet"].map((d) => ({ value: d, label: d }))} />
            <FilterDate name="from" label="From" value={str(params, "from")} />
            <FilterDate name="to" label="To" value={str(params, "to")} />
            {str(params, "country") ? <input type="hidden" name="country" value={str(params, "country")} /> : null}
          </FilterBar>
        }
        footer={<Pagination page={page} pageCount={pageCount(total)} hrefFor={(p) => hrefWith("/admin/analytics/visits", params, { page: p })} />}
      >
        {rows.length ? (
          <Table scrollLabel="Visits">
            <THead>
              <tr>
                <Th>Started</Th>
                <Th>Landing page</Th>
                <Th>Source</Th>
                <Th>Location</Th>
                <Th>Device</Th>
                <Th className="text-right">Pages</Th>
                <Th>Duration</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((v) => (
                <Tr key={v.id}>
                  <Td className="text-sm whitespace-nowrap">
                    <Link href={`/admin/analytics/visits/${v.id}`} className="font-medium text-umber-900 underline-offset-2 hover:underline">
                      {formatDateTime(v.startedAt)}
                    </Link>
                  </Td>
                  <Td>
                    <code className="text-xs">{v.landingPath}</code>
                  </Td>
                  <Td className="max-w-56 truncate text-sm text-umber-600">{v.referrer ?? "Direct"}</Td>
                  <Td className="text-sm">
                    {flag(v.countryCode)} {placeLabel(v)} {v.isDatacenter ? <Badge tone="pending">Datacenter</Badge> : null}
                  </Td>
                  <Td className="text-sm text-umber-600">
                    {v.device ?? "—"} · {v.browser ?? "—"}
                  </Td>
                  <Td className="text-right tabular-nums">{v.pageCount}</Td>
                  <Td className="text-sm text-umber-600">{duration(v.startedAt, v.lastSeenAt)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No visits match. Visits are recorded only for visitors who allowed Statistics.</Empty>
        )}
      </TableCard>
      <p className="text-xs text-umber-500">{total} visits</p>
    </div>
  );
}
