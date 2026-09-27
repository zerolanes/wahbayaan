import Link from "next/link";
import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import { ScoreRing } from "@/components/admin/charts";
import { Badge, Card, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { getReadiness } from "@/lib/admin/readiness-data";
import { groupItems, scoreReadiness, type CheckStatus } from "@/lib/admin/readiness";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Launch readiness" };

const ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <CheckCircle2 className="size-5 text-success-600" />,
  warn: <CircleAlert className="size-5 text-pending-600" />,
  fail: <CircleX className="size-5 text-danger-600" />,
};
const PILL: Record<CheckStatus, { tone: "success" | "pending" | "danger"; label: string }> = {
  pass: { tone: "success", label: "Pass" },
  warn: { tone: "pending", label: "Warning" },
  fail: { tone: "danger", label: "Blocking" },
};

export default async function ReadinessPage(props: PageProps<"/admin/readiness">) {
  await requireStaff("dashboard.view");
  const { show } = await props.searchParams;
  const items = await getReadiness();
  const score = scoreReadiness(items);
  const filter = show === "fail" || show === "warn" || show === "pass" ? show : null;
  const groups = groupItems(filter ? items.filter((i) => i.status === filter) : items);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title="Launch readiness"
        description="The acceptance checklist, computed live from the database and environment. Fix every blocking item before going live."
      />
      <Card className="flex flex-wrap items-center gap-8 p-6">
        <ScoreRing score={score.score} />
        <div className="min-w-60 flex-1">
          <p className="font-display text-2xl text-umber-900">
            {score.verdict === "ready" ? "Ready to launch" : score.verdict === "almost" ? "Almost there — only warnings left" : "Not ready to launch yet"}
          </p>
          <p className="mt-1 text-umber-600">
            {score.pass} of {score.total} checks pass · {score.warn} warning{score.warn === 1 ? "" : "s"} · {score.fail} blocking. Score weights a warning as half a pass.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {([null, "fail", "warn", "pass"] as const).map((f) => (
              <Link
                key={f ?? "all"}
                href={f ? `/admin/readiness?show=${f}` : "/admin/readiness"}
                className={cn("rounded-full border px-3 py-1", filter === f ? "border-indigo-900 bg-indigo-900 text-sand-50" : "border-umber-200 text-umber-700 hover:border-umber-400")}
              >
                {f == null ? `All (${score.total})` : f === "fail" ? `Blocking (${score.fail})` : f === "warn" ? `Warnings (${score.warn})` : `Passing (${score.pass})`}
              </Link>
            ))}
          </div>
        </div>
      </Card>

      {groups.map((g) => (
        <section key={g.group} className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wider text-umber-500 uppercase">{g.group}</h2>
          <Card className="divide-y divide-umber-200/60 overflow-hidden">
            {g.items.map((item) => (
              <details key={item.id} className="group" open={item.status === "fail" && !!item.examples?.length && item.examples.length <= 3}>
                <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-4 hover:bg-gold-50/40 [&::-webkit-details-marker]:hidden">
                  <span className="mt-0.5">{ICON[item.status]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-umber-900">{item.title}</p>
                      <Badge tone={PILL[item.status].tone}>{PILL[item.status].label}</Badge>
                      {item.status !== "pass" && (item.count > 1 || item.examples?.length) ? <span className="text-xs text-umber-500 tabular-nums">{item.count} found</span> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-umber-600">{item.detail}</p>
                  </div>
                  <Link href={item.href} className="shrink-0 rounded-full border border-umber-200 px-3 py-1 text-sm text-umber-800 hover:border-umber-900">
                    {item.status === "pass" ? "Open" : (item.fixLabel ?? "Fix")} →
                  </Link>
                </summary>
                {item.examples?.length ? (
                  <ul className="space-y-1.5 bg-sand-100/50 px-5 py-3 pl-14 text-sm">
                    {item.examples.map((e, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                        {e.href ? (
                          <Link href={e.href} className="text-terracotta-700 hover:underline">
                            {e.label}
                          </Link>
                        ) : (
                          <span>{e.label}</span>
                        )}
                        {e.reasons?.length ? <span className="text-umber-500">— {e.reasons.join(" · ")}</span> : null}
                      </li>
                    ))}
                    {item.count > item.examples.length ? <li className="text-umber-500">…and {item.count - item.examples.length} more</li> : null}
                  </ul>
                ) : null}
              </details>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}
