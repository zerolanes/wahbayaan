import Link from "next/link";
import { AnalyticsTabs, flag, placeLabel } from "@/components/admin/analytics";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { Empty, MiniStat, TableCard } from "@/components/admin/ui";
import { VisitorMapSlot } from "@/components/admin/visitor-map-slot";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { getLiveVisits } from "@/lib/analytics/stats";
import { timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Live now" };

export default async function LivePage() {
  await requireStaff("analytics.view");
  const rows = await getLiveVisits();
  const pages = new Map<string, number>();
  for (const r of rows) if (r.currentPath) pages.set(r.currentPath, (pages.get(r.currentPath) ?? 0) + 1);
  const topPage = [...pages.entries()].sort((a, b) => b[1] - a[1])[0];
  const countries = new Set(rows.map((r) => r.countryCode).filter(Boolean));
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Insights" title="Live now" description="Visits with a page view or heartbeat in the last 2 minutes (visitors who allowed Statistics; heartbeats every 30 s while the tab is visible)." actions={<AutoRefresh seconds={15} />} />
      <AnalyticsTabs active="/admin/analytics/live" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <MiniStat label="Visitors online" value={String(rows.length)} />
        <MiniStat label="Countries" value={String(countries.size)} />
        <MiniStat label="Busiest page" value={topPage ? topPage[0] : "—"} hint={topPage ? `${topPage[1]} viewing` : undefined} />
      </div>
      <VisitorMapSlot liveOnly />
      <TableCard>
        {rows.length ? (
          <Table scrollLabel="Live visitors">
              <THead>
                <tr>
                  <Th>Current page</Th>
                  <Th>Location</Th>
                  <Th>Device</Th>
                  <Th className="text-right">Pages</Th>
                  <Th>Arrived</Th>
                  <Th>Last activity</Th>
                  <Th><span className="sr-only">Actions</span></Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <code className="text-xs">{r.currentPath ?? r.landingPath}</code>
                    </Td>
                    <Td className="text-sm">
                      {flag(r.countryCode)} {placeLabel(r)} {r.isDatacenter ? <Badge tone="pending">Datacenter</Badge> : null}
                    </Td>
                    <Td className="text-sm text-umber-600">
                      {r.device ?? "—"} · {r.browser ?? "—"}
                    </Td>
                    <Td className="text-right tabular-nums">{r.pageCount}</Td>
                    <Td className="text-sm text-umber-600">{timeAgo(r.startedAt)}</Td>
                    <Td className="text-sm text-umber-600">{timeAgo(r.lastSeenAt)}</Td>
                    <Td className="text-right">
                      <Link href={`/admin/analytics/visits/${r.id}`} className="text-sm text-umber-700 underline hover:text-umber-900">
                        Journey
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </TBody>
          </Table>
        ) : (
          <Empty>Nobody online right now.</Empty>
        )}
      </TableCard>
    </div>
  );
}
