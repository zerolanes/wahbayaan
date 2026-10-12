import Link from "next/link";
import { BarChart, HBarList, ShareBar } from "@/components/admin/charts";
import { AnalyticsTabs, PeriodChips, flag } from "@/components/admin/analytics";
import { ExportLink, MiniStat, Panel } from "@/components/admin/ui";
import { VisitorMapSlot } from "@/components/admin/visitor-map-slot";
import { Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { SERIES_COLORS } from "@/lib/admin/series";
import { getStats, statsRange } from "@/lib/analytics/stats";
import { getAnalyticsSettings } from "@/lib/analytics/store";

export const metadata = { title: "Visitor statistics" };

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

export default async function AnalyticsPage(props: PageProps<"/admin/analytics">) {
  await requireStaff("analytics.view");
  const params = await props.searchParams;
  const range = statsRange(params);
  const [s, settings] = await Promise.all([getStats(range), getAnalyticsSettings()]);
  const t = s.totals;
  const share = (rows: { key: string; visits: number }[]) =>
    rows.map((r, i) => ({ key: r.key, label: r.key, value: r.visits, display: fmt(r.visits), color: SERIES_COLORS[Math.min(i, SERIES_COLORS.length - 1)] }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Visitor statistics"
        description="First-party statistics from visitors who allowed Statistics in the cookie banner. Visitors who continued without consent are not counted, so these numbers are a lower bound."
        actions={<ExportLink href={`/admin/export/analytics?type=visits&from=${range.fromStr}&to=${range.toStr}`}>Visits CSV</ExportLink>}
      />
      <AnalyticsTabs active="/admin/analytics" />
      <PeriodChips path="/admin/analytics" params={params} range={range} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Page views" value={fmt(t.views)} hint={`${range.days} day${range.days === 1 ? "" : "s"}`} />
        <MiniStat label="Visits" value={fmt(t.visits)} hint="Started in this period" />
        <MiniStat label="Unique visitors" value={fmt(t.uniqueVisitors)} hint="Distinct consent ids" />
        <MiniStat label="Pages per visit" value={t.pagesPerVisit == null ? "—" : t.pagesPerVisit.toFixed(1)} />
      </div>

      <Panel title={range.hourly ? "Page views by hour (UTC)" : "Page views by day"} description="Bars: page views. Hover a bar for visits too.">
        <BarChart
          title="Page views"
          data={s.series.map((p) => ({ key: p.key, label: p.label, value: p.views, display: `${fmt(p.views)} views · ${fmt(p.visits)} visits` }))}
          labelEvery={range.hourly ? 3 : undefined}
        />
      </Panel>

      <VisitorMapSlot />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Top pages" description="Page views and the visits that saw each page.">
          <HBarList items={s.pages.map((p) => ({ key: p.path, label: <code className="text-xs">{p.path}</code>, value: p.views, display: `${fmt(p.views)} · ${fmt(p.visits)} visits` }))} empty="No page views in this period" />
        </Panel>
        <Panel title="Referrers" description="Where visits came from (first page of each visit).">
          <HBarList items={s.referrers.map((r) => ({ key: r.referrer ?? "direct", label: r.referrer ?? "Direct / none", value: r.visits, display: fmt(r.visits) }))} empty="No visits in this period" />
        </Panel>
        <Panel title="Countries" description={`Location: ${settings.geoProvider === "off" ? "lookups are off" : "Cloudflare headers or the IP-location provider"}.`}>
          <HBarList
            items={s.countries.map((c) => ({
              key: c.code ?? "unknown",
              label: c.code ? `${flag(c.code)} ${c.name ?? c.code}` : "Unknown",
              value: c.visits,
              display: `${fmt(c.visits)} · ${fmt(c.unique)} unique`,
              href: `/admin/analytics/visits?country=${c.code ?? "--"}&from=${range.fromStr}&to=${range.toStr}`,
            }))}
            empty="No visits in this period"
          />
        </Panel>
        <Panel title="Devices & browsers">
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-medium text-umber-500">Devices</p>
              <ShareBar parts={share(s.devices)} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-umber-500">Browsers</p>
              <ShareBar parts={share(s.browsers)} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-umber-500">Operating systems</p>
              <ShareBar parts={share(s.oses)} />
            </div>
          </div>
        </Panel>
      </div>
      {!t.views ? (
        <Notice tone="indigo" title="No statistics yet for this period">
          Data appears once visitors accept Statistics in the cookie banner. See <Link className="underline" href="/admin/analytics/consent">the consent log</Link> for decisions.
        </Notice>
      ) : null}
    </div>
  );
}
