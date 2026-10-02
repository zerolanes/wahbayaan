import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { setFeatureFlagAction } from "@/app/actions/admin/settings";
import { ActionForm } from "@/components/admin/action-form";
import { SwitchSubmit } from "@/components/admin/switch";
import { MiniStat, TableCard } from "@/components/admin/ui";
import { Badge, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { auditLog, users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { auditDiff } from "@/lib/admin/diff";
import { FLAG_KEYS, FLAG_META } from "@/lib/admin/flags";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Feature flags" };

export default async function FlagsPage() {
  await requireStaff("settings.manage");
  const d = await db();
  const [flags, history] = await Promise.all([
    getSetting("feature_flags"),
    d
      .select({ id: auditLog.id, summary: auditLog.summary, data: auditLog.data, createdAt: auditLog.createdAt, actor: users.name })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .where(and(eq(auditLog.entity, "setting"), eq(auditLog.entityId, "feature_flags")))
      .orderBy(desc(auditLog.createdAt))
      .limit(200),
  ]);
  const lastChange = (key: string) => history.find((h) => auditDiff(h.data)?.some((x) => x.path === key));
  const on = FLAG_KEYS.filter((k) => flags[k]).length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="System" title="Feature flags" description="Switch storefront features on or off without a deploy. Every change is recorded in the audit log." />
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="On" value={String(on)} hint={`of ${FLAG_KEYS.length} features`} />
        <MiniStat label="Off" value={String(FLAG_KEYS.length - on)} />
        <MiniStat label="Last change" value={history[0] ? timeAgo(history[0].createdAt) : "Never"} hint={history[0] ? `${history[0].actor ?? "System"} · ${history[0].summary}` : "All flags at their defaults"} href={history[0] ? "/admin/audit?entity=setting&entityId=feature_flags" : undefined} />
      </div>
      <Notice tone="indigo" title="Where flags take effect">
        Switching a feature off takes its storefront pages offline (they return “not found”) and removes its links from the menu and footer.
      </Notice>
      <TableCard>
        <ul className="divide-y divide-umber-200/70">
          {FLAG_KEYS.map((key) => {
            const meta = FLAG_META[key];
            const enabled = flags[key];
            const last = lastChange(key);
            return (
              <li key={key} className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-umber-900">
                    {meta.label} <code className="text-xs font-normal text-umber-500">{key}</code>
                    {enabled ? <Badge tone="success">On</Badge> : <Badge tone="neutral">Off</Badge>}
                  </p>
                  <p className="mt-0.5 text-sm text-umber-600">{meta.description}</p>
                  <p className="mt-1.5 text-xs text-umber-500">Affects: {meta.surfaces.join(" · ")}</p>
                  {last ? (
                    <p className="mt-1 text-xs text-umber-400" title={formatDateTime(last.createdAt)}>
                      Last changed by {last.actor ?? "System"} {timeAgo(last.createdAt)}
                    </p>
                  ) : null}
                </div>
                <ActionForm action={setFeatureFlagAction} className="pt-0.5">
                  <input type="hidden" name="flag" value={key} />
                  <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
                  <SwitchSubmit on={enabled} label={`${meta.label}: ${enabled ? "on" : "off"}`} confirm={enabled ? `Turn off ${meta.label}? Buyers will stop seeing it.` : undefined} />
                </ActionForm>
              </li>
            );
          })}
        </ul>
      </TableCard>
      <p className="text-xs text-umber-500">
        Business settings (store info, escrow, payouts, maintenance mode) live in{" "}
        <Link href="/admin/settings" className="underline">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}
