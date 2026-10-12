import { AnalyticsTabs, DECISION_LABEL } from "@/components/admin/analytics";
import { Empty, ExportLink, FilterBar, FilterDate, FilterSelect, MiniStat, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader, Pagination, type Tone } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { hrefWith, pageCount, str } from "@/lib/admin/params";
import { listConsentRecords } from "@/lib/analytics/stats";
import { getAnalyticsSettings } from "@/lib/analytics/store";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Consent log" };

const TONE: Record<string, Tone> = { accept_all: "success", essentials: "neutral", custom: "indigo", revoke: "danger" };

export default async function ConsentLogPage(props: PageProps<"/admin/analytics/consent">) {
  await requireStaff("analytics.view");
  const params = await props.searchParams;
  const [{ rows, total, page, byDecision }, settings] = await Promise.all([listConsentRecords(params), getAnalyticsSettings()]);
  const qs = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && v && k !== "page" ? [[k, v]] : []))).toString();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Consent log"
        description={`Proof of consent: every banner decision with the shortened IP (IPv4 /24, IPv6 /48). Current consent version: ${settings.consentRev}. Kept for ${settings.consentRetentionDays} days.`}
      />
      <AnalyticsTabs active="/admin/analytics/consent" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["accept_all", "essentials", "custom", "revoke"] as const).map((k) => (
          <MiniStat key={k} label={DECISION_LABEL[k]} value={String(byDecision[k] ?? 0)} hint="Matching the filters" />
        ))}
      </div>
      <TableCard
        toolbar={
          <FilterBar action="/admin/analytics/consent" q={str(params, "q")} placeholder="Consent id or shortened IP…" extra={<ExportLink href={`/admin/export/analytics?type=consent${qs ? `&${qs}` : ""}`}>CSV</ExportLink>}>
            <FilterSelect name="decision" label="Decision" value={str(params, "decision")} options={Object.entries(DECISION_LABEL).map(([value, label]) => ({ value, label }))} />
            <FilterSelect name="rev" label="Version" value={str(params, "rev")} options={Array.from({ length: settings.consentRev }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
            <FilterDate name="from" label="From" value={str(params, "from")} />
            <FilterDate name="to" label="To" value={str(params, "to")} />
          </FilterBar>
        }
        footer={<Pagination page={page} pageCount={pageCount(total)} hrefFor={(p) => hrefWith("/admin/analytics/consent", params, { page: p })} />}
      >
        {rows.length ? (
          <Table scrollLabel="Consent records">
            <THead>
              <tr>
                <Th>When</Th>
                <Th>Consent id</Th>
                <Th>Decision</Th>
                <Th>Categories</Th>
                <Th className="text-right">Version</Th>
                <Th>IP (shortened)</Th>
                <Th>Browser</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const c = r.categories as Record<string, boolean>;
                const on = ["statistics", "functional", "marketing"].filter((k) => c[k]);
                return (
                  <Tr key={r.id}>
                    <Td className="text-sm whitespace-nowrap">{formatDateTime(r.createdAt)}</Td>
                    <Td>
                      <code className="text-xs">{r.consentId}</code>
                    </Td>
                    <Td>
                      <Badge tone={TONE[r.decision] ?? "neutral"}>{DECISION_LABEL[r.decision] ?? r.decision}</Badge>
                    </Td>
                    <Td className="text-sm text-umber-700">Essential{on.length ? `, ${on.map((k) => k[0].toUpperCase() + k.slice(1)).join(", ")}` : " only"}</Td>
                    <Td className="text-right tabular-nums">
                      {r.rev}
                      {r.rev < settings.consentRev ? <span className="sr-only"> (outdated)</span> : null}
                    </Td>
                    <Td>
                      <code className="text-xs">{r.ipShort ?? "—"}</code>
                    </Td>
                    <Td className="max-w-64 truncate text-xs text-umber-500" title={r.userAgent ?? undefined}>
                      {r.userAgent ?? "—"}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>No consent decisions match.</Empty>
        )}
      </TableCard>
      <p className="text-xs text-umber-500">{total} records</p>
    </div>
  );
}
