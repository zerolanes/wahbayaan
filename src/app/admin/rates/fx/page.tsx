import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { RefreshCw } from "lucide-react";
import { refreshFxAction, saveFxMarkupAction, saveFxRateAction } from "@/app/actions/admin/rates";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, TextInput } from "@/components/admin/controls";
import { EditRow } from "@/components/admin/edit-row";
import { RatesTabs, SourceCell } from "@/components/admin/rates";
import { Empty, MiniStat, Panel, TableCard } from "@/components/admin/ui";
import { Badge, Notice, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { auditLog, fxRates, users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { bpsToPercentString } from "@/lib/admin/money";
import { formatAge, fxFreshness, FX_STALE_HOURS } from "@/lib/admin/rate-coverage";
import { CURRENCY_META, DEFAULT_BUYER_CURRENCIES } from "@/lib/money/currency";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Exchange rates" };

const STATE_BADGE = {
  fresh: <Badge tone="success">Current</Badge>,
  stale: <Badge tone="warning">Stale</Badge>,
  placeholder: <Badge tone="pending">Placeholder</Badge>,
  missing: <Badge tone="pending">Pending</Badge>,
} as const;

const KIND_LABEL = { live: "Live (provider)", manual: "Manual", placeholder: "Placeholder" } as const;

export default async function FxRatesPage() {
  const user = await requireStaff("rates.view");
  const canManage = user.permissions.has("rates.manage");
  const d = await db();
  const [rows, fx, history] = await Promise.all([
    d.select().from(fxRates),
    getSetting("fx"),
    d
      .select({ id: auditLog.id, action: auditLog.action, summary: auditLog.summary, createdAt: auditLog.createdAt, actor: users.name })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .where(inArray(auditLog.action, ["fx.update", "fx.refresh", "fx.refresh_failed", "cron.fx_refresh", "setting.fx"]))
      .orderBy(desc(auditLog.createdAt))
      .limit(12),
  ]);
  const now = new Date();
  const markup = fx.markupBps ?? 0;
  const list = DEFAULT_BUYER_CURRENCIES.map((c) => {
    const row = rows.find((r) => r.currency === c) ?? null;
    return { currency: c, row, fresh: fxFreshness(row, now) };
  });
  const attention = list.filter((x) => x.fresh.state !== "fresh");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cross-border"
        title="Exchange rates"
        description="PKR per unit of each buyer currency. Listing prices are stored in PKR and converted at these rates, after the FX markup."
        actions={
          canManage ? (
            <ActionButton action={refreshFxAction} variant="primary">
              <RefreshCw className="size-3.5" /> Refresh from provider
            </ActionButton>
          ) : null
        }
      />
      <RatesTabs active="/admin/rates/fx" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {list.map(({ currency, row, fresh }) => (
          <MiniStat
            key={currency}
            label={`${CURRENCY_META[currency].name} (${currency})`}
            value={row ? `Rs ${Number(row.pkrPerUnit).toFixed(2)}` : "Pending"}
            tone={row && fresh.state === "fresh" ? undefined : "pending"}
            hint={row ? `${KIND_LABEL[row.status]} · ${formatAge(fresh.ageHours)} old` : "No rate stored"}
          />
        ))}
        <MiniStat label="FX markup" value={`${bpsToPercentString(markup) || 0}%`} hint={markup ? "Buyers get slightly fewer PKR per unit" : "Buyers get the stored rate"} />
      </div>

      {attention.length ? (
        <Notice tone="pending" title={`${attention.length} rate${attention.length === 1 ? " needs" : "s need"} attention`}>
          {attention.map((a) => `${a.currency}: ${a.fresh.state === "placeholder" ? "placeholder demo value" : a.fresh.state === "missing" ? "no rate stored" : `stale (${formatAge(a.fresh.ageHours)} old)`}`).join(" · ")}. Live rates go stale after {FX_STALE_HOURS.live} h, manual rates after {FX_STALE_HOURS.manual / 24} days.
        </Notice>
      ) : null}

      <TableCard toolbar={<p className="text-sm text-umber-600">Buyer currencies</p>}>
        <Table>
          <THead>
            <tr>
              <Th>Currency</Th>
              <Th className="text-right">PKR per unit</Th>
              <Th className="text-right">Buyer rate after markup</Th>
              <Th>Kind</Th>
              <Th>Freshness</Th>
              <Th>Last updated / source</Th>
              {canManage ? <Th className="w-20" /> : null}
            </tr>
          </THead>
          <TBody>
            {list.map(({ currency, row, fresh }) => {
              const cells = (
                <>
                  <Td>
                    <p className="font-medium text-umber-900">{currency}</p>
                    <p className="text-xs text-umber-500">{CURRENCY_META[currency].name}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{row ? Number(row.pkrPerUnit).toFixed(4) : <Badge tone="pending">Pending</Badge>}</Td>
                  <Td className="text-right text-umber-600 tabular-nums">{row ? (Number(row.pkrPerUnit) * (1 - markup / 10_000)).toFixed(4) : "—"}</Td>
                  <Td>{row ? KIND_LABEL[row.status] : "—"}</Td>
                  <Td>
                    {STATE_BADGE[fresh.state]}
                    {row ? <p className="mt-0.5 text-xs text-umber-500">{formatAge(fresh.ageHours)} old</p> : null}
                  </Td>
                  <Td>
                    <SourceCell source={row?.source} updatedAt={row?.updatedAt} />
                  </Td>
                </>
              );
              if (!canManage) return <tr key={currency}>{cells}</tr>;
              return (
                <EditRow
                  key={currency}
                  colSpan={6}
                  cells={cells}
                  label="Set rate"
                  editor={
                    <ActionForm action={saveFxRateAction} className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="currency" value={currency} />
                      <FieldRow label={`PKR per 1 ${currency}`}>
                        <TextInput name="pkrPerUnit" inputMode="decimal" defaultValue={row ? Number(row.pkrPerUnit).toString() : ""} required className="w-36" />
                      </FieldRow>
                      <FieldRow label="Source" hint="e.g. State Bank of Pakistan interbank rate, 28 Sep" className="min-w-72 flex-1">
                        <TextInput name="source" placeholder={`Manual — set by ${user.name}`} />
                      </FieldRow>
                      <SubmitButton>Save as manual rate</SubmitButton>
                    </ActionForm>
                  }
                />
              );
            })}
          </TBody>
        </Table>
      </TableCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="FX markup" description="A small buffer against currency movement between checkout and settlement. Applied to every conversion.">
          {canManage ? (
            <ActionForm action={saveFxMarkupAction} className="flex flex-wrap items-end gap-3">
              <FieldRow label="Markup %" hint="0 for none. Above 10% is rejected.">
                <TextInput name="markupPercent" inputMode="decimal" defaultValue={bpsToPercentString(markup)} placeholder="0" className="w-28" />
              </FieldRow>
              <SubmitButton>Save markup</SubmitButton>
            </ActionForm>
          ) : (
            <p className="text-sm text-umber-700">{bpsToPercentString(markup) || 0}%</p>
          )}
          <p className="mt-3 text-xs text-umber-500">
            Scheduled refresh: <code>/api/cron/fx-refresh</code> daily at 05:30 UTC {process.env.CRON_SECRET ? "(CRON_SECRET set)" : "— CRON_SECRET is not set, so the job cannot run"}. See{" "}
            <Link href="/admin/health" className="underline">
              System health
            </Link>
            .
          </p>
        </Panel>
        <Panel title="Recent changes" description="From the audit log" bodyClassName="p-0">
          {history.length ? (
            <ul className="divide-y divide-umber-200/60">
              {history.map((h) => (
                <li key={h.id} className="px-5 py-2.5 text-sm">
                  <p className="text-umber-800">{h.summary}</p>
                  <p className="text-xs text-umber-500" title={formatDateTime(h.createdAt)}>
                    {h.actor ?? "System"} · <code>{h.action}</code> · {timeAgo(h.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No exchange-rate changes recorded yet.</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}
