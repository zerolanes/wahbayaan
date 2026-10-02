import Link from "next/link";
import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { CoverageBar } from "@/components/admin/rates";
import { KV, Panel, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { envReport } from "@/lib/admin/env-report";
import { databaseHealth, emailHealth, jobHealth, rateHealth, tableCounts } from "@/lib/admin/health";
import { formatAge } from "@/lib/admin/rate-coverage";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "System health" };

type Level = "ok" | "warn" | "fail";

function Dot({ level }: { level: Level }) {
  return level === "ok" ? <CircleCheck className="size-4 text-success-600" /> : level === "warn" ? <CircleDashed className="size-4 text-warning-600" /> : <CircleAlert className="size-4 text-danger-600" />;
}

function Check({ level, title, detail, href }: { level: Level; title: ReactNode; detail: ReactNode; href?: string }) {
  const body = (
    <div className="flex items-start gap-3 px-5 py-3">
      <span className="mt-0.5">
        <Dot level={level} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-umber-900">{title}</p>
        <p className="text-xs text-umber-500">{detail}</p>
      </div>
    </div>
  );
  return <li>{href ? <Link href={href} className="block hover:bg-umber-50">{body}</Link> : body}</li>;
}

export default async function HealthPage() {
  await requireStaff("settings.manage");
  const now = new Date();
  const dbh = await databaseHealth();
  const [counts, email, rates, jobs] = dbh.ok ? await Promise.all([tableCounts(), emailHealth(), rateHealth(now), jobHealth(now)]) : [null, null, null, null];
  const env = envReport(process.env);

  const checks: { level: Level; title: string; detail: ReactNode; href?: string }[] = [];
  checks.push(dbh.ok ? { level: dbh.latencyMs > 500 ? "warn" : "ok", title: "Database reachable", detail: `${dbh.driver} · ${dbh.version} · ${dbh.latencyMs} ms` } : { level: "fail", title: "Database unreachable", detail: dbh.error });
  if (dbh.ok) {
    const m = dbh.migrations;
    checks.push(
      m.error
        ? { level: "fail", title: "Migrations table unreadable", detail: m.error }
        : m.files != null && m.applied < m.files
          ? { level: "fail", title: "Migrations pending", detail: `${m.applied} of ${m.files} applied — restart with AUTO_MIGRATE on or run npm run db:migrate.` }
          : { level: "ok", title: "Migrations applied", detail: `${m.applied} of ${m.files ?? "?"} · latest ${m.latestTag ?? "—"}${m.latestAppliedAt ? ` · applied ${formatDateTime(m.latestAppliedAt)}` : ""}` },
    );
  }
  if (email) {
    checks.push(
      !email.configured
        ? { level: "warn", title: "Email sending not configured", detail: `RESEND_API_KEY is not set — ${email.logged} email(s) logged to the outbox, none delivered.`, href: "/admin/emails?status=logged" }
        : email.stuck || email.failed7
          ? { level: "fail", title: "Email delivery problems", detail: `${email.stuck} stuck in queue · ${email.failed7} failed in the last 7 days`, href: "/admin/emails?status=failed" }
          : { level: "ok", title: "Email delivering", detail: `${email.sent7} sent in the last 7 days${email.last_sent ? ` · last ${timeAgo(email.last_sent)}` : ""}`, href: "/admin/emails" },
    );
  }
  if (rates) {
    const badFx = rates.fx.filter((f) => f.state !== "fresh");
    checks.push(badFx.length ? { level: badFx.some((f) => f.state === "placeholder" || f.state === "missing") ? "fail" : "warn", title: "Exchange rates need attention", detail: badFx.map((f) => `${f.currency} ${f.state}${f.ageHours != null ? ` (${formatAge(f.ageHours)})` : ""}`).join(" · "), href: "/admin/rates/fx" } : { level: "ok", title: "Exchange rates current", detail: rates.fx.map((f) => `${f.currency} ${formatAge(f.ageHours)} old`).join(" · "), href: "/admin/rates/fx" });
    const pendingFees = rates.fees.filter((f) => f.pending);
    checks.push({ level: rates.shipping.active < rates.shipping.total || rates.duty.active < rates.duty.total ? "warn" : "ok", title: "Rate coverage", detail: `Shipping ${rates.shipping.active}/${rates.shipping.total} bands · duty ${rates.duty.active}/${rates.duty.total} destination × craft · import rules ${rates.rules.reviewed}/${rates.rules.total} reviewed`, href: "/admin/rates/shipping?status=pending" });
    checks.push(pendingFees.length ? { level: "warn", title: `${pendingFees.length} business setting${pendingFees.length === 1 ? "" : "s"} pending`, detail: pendingFees.map((f) => f.label).join(", "), href: "/admin/rates/fees" } : { level: "ok", title: "Fees and protection settings decided", detail: "Handling, commission, gift wrap, escrow and return window are all set." });
  }
  if (jobs) {
    checks.push(!jobs.secretSet ? { level: "fail", title: "Scheduled jobs cannot run", detail: "CRON_SECRET is not set, so /api/cron/* rejects every call." } : jobs.overdueReleases ? { level: "fail", title: "Escrow auto-release is behind", detail: `${jobs.overdueReleases} delivered order(s) are past their release date with funds still held.`, href: "/admin/escrow" } : { level: "ok", title: "Scheduled jobs configured", detail: "CRON_SECRET set; no releases overdue." });
  }
  const demo = env.find((e) => e.name === "DEMO_MODE");
  if (demo?.tone === "warn") checks.push({ level: "warn", title: "Demo mode is on", detail: "Seeded demo data is visible (with a ribbon). Turn DEMO_MODE off for launch.", href: "/admin/readiness" });

  const worst: Level = checks.some((c) => c.level === "fail") ? "fail" : checks.some((c) => c.level === "warn") ? "warn" : "ok";
  const groups = [...new Set(env.map((e) => e.group))];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="System health"
        description="Live checks of the database, email delivery, rates and scheduled jobs. Secrets are shown only as set or not set."
        actions={<Badge tone={worst === "ok" ? "success" : worst === "warn" ? "warning" : "danger"}>{worst === "ok" ? "All systems normal" : worst === "warn" ? "Needs attention" : "Action required"}</Badge>}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Checks" description={`Run ${formatDateTime(now)}`} bodyClassName="p-0">
          <ul className="divide-y divide-umber-200/60">
            {checks.map((c, i) => (
              <Check key={i} {...c} />
            ))}
          </ul>
        </Panel>

        <div className="space-y-6">
          {jobs ? (
            <Panel title="Scheduled jobs" description="Configured in vercel.json; runs are recorded in the audit log." bodyClassName="p-0">
              <Table>
                <THead>
                  <tr>
                    <Th>Job</Th>
                    <Th>Schedule (UTC)</Th>
                    <Th>Last recorded run</Th>
                  </tr>
                </THead>
                <TBody>
                  {jobs.jobs.map((j) => (
                    <tr key={j.id}>
                      <Td>
                        <p className="font-medium text-umber-900">{j.label}</p>
                        <code className="text-xs text-umber-500">{j.path}</code>
                      </Td>
                      <Td>
                        <code className="text-xs">{j.schedule ?? "not scheduled"}</code>
                      </Td>
                      <Td className="text-xs">
                        {j.last ? (
                          <>
                            <p className={cn(j.failed ? "text-danger-700" : "text-umber-800")}>{j.last.summary}</p>
                            <p className="text-umber-500" title={formatDateTime(j.last.createdAt)}>
                              {timeAgo(j.last.createdAt)}
                            </p>
                          </>
                        ) : (
                          <span className="text-umber-500">{j.id === "auto-release" ? "No releases logged yet (only runs that release funds are recorded)" : "Never recorded"}</span>
                        )}
                        {j.id === "fx-refresh" && j.last && j.late ? <Badge tone="warning">Late</Badge> : null}
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            </Panel>
          ) : null}

          {rates ? (
            <Panel title="Rate coverage" description="What can be quoted to buyers right now.">
              <div className="space-y-4">
                <CoverageBar n={rates.shipping.active} total={rates.shipping.total} label="Shipping: destination × weight band" />
                <CoverageBar n={rates.duty.active} total={rates.duty.total} label="Duty: destination × craft" />
                <CoverageBar n={rates.rules.reviewed} total={rates.rules.total} label="Import rules reviewed" />
                <CoverageBar n={rates.fees.filter((f) => !f.pending).length} total={rates.fees.length} label="Fees & protection decided" />
              </div>
            </Panel>
          ) : null}

          {email ? (
            <Panel title="Email outbox" action={<Link href="/admin/emails" className="text-xs text-umber-500 hover:text-umber-900">Open outbox</Link>}>
              <KV
                items={[
                  ["Sending", email.configured ? <Badge key="c" tone="success">Configured</Badge> : <Badge key="c" tone="pending">Not configured</Badge>],
                  ["Queued", `${email.queued}${email.stuck ? ` (${email.stuck} stuck)` : ""}`],
                  ["Failed, last 7 days", String(email.failed7)],
                  ["Logged, never sent", String(email.logged)],
                  ["Last delivered", email.last_sent ? timeAgo(email.last_sent) : "—"],
                ]}
              />
            </Panel>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {counts ? (
          <TableCard toolbar={<p className="text-sm text-umber-600">Key tables</p>}>
            <Table>
              <THead>
                <tr>
                  <Th>Table</Th>
                  <Th className="text-right">Rows</Th>
                  <Th className="text-right">Demo rows</Th>
                </tr>
              </THead>
              <TBody>
                {counts.map((c) => (
                  <tr key={c.table}>
                    <Td>
                      <code className="text-xs">{c.table}</code>
                    </Td>
                    <Td className="text-right tabular-nums">{c.rows.toLocaleString("en-US")}</Td>
                    <Td className="text-right text-umber-500 tabular-nums">{c.demo == null ? "—" : c.demo.toLocaleString("en-US")}</Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          </TableCard>
        ) : null}

        <TableCard toolbar={<p className="text-sm text-umber-600">Environment</p>}>
          <Table>
            <THead>
              <tr>
                <Th>Variable</Th>
                <Th>State</Th>
                <Th>What it does</Th>
              </tr>
            </THead>
            <TBody>
              {groups.map((g) => (
                <GroupRows key={g} group={g} items={env.filter((e) => e.group === g)} />
              ))}
            </TBody>
          </Table>
        </TableCard>
      </div>
    </div>
  );
}

function GroupRows({ group, items }: { group: string; items: ReturnType<typeof envReport> }) {
  return (
    <>
      <tr className="bg-umber-50">
        <td colSpan={3} className="px-4 py-1.5 text-xs font-semibold tracking-wide text-umber-500 uppercase">
          {group}
        </td>
      </tr>
      {items.map((e) => (
        <tr key={e.name}>
          <Td>
            <code className="text-xs text-umber-900">{e.name}</code>
          </Td>
          <Td className="whitespace-nowrap">
            {e.value != null ? <code className={cn("rounded px-1.5 py-0.5 text-xs", e.tone === "warn" ? "bg-warning-50 text-warning-700" : "bg-umber-100 text-umber-800")}>{e.value}</code> : <Badge tone={e.tone === "warn" ? "warning" : e.set ? "success" : "neutral"}>{e.set ? "Set" : "Not set"}</Badge>}
          </Td>
          <Td className="min-w-56 text-xs text-umber-500">{e.note}</Td>
        </tr>
      ))}
    </>
  );
}
