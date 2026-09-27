import Link from "next/link";
import { Badge, PageHeader, Tabs } from "@/components/ui/misc";
import { TableCard } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/session";
import { activityFeed, type ActivityItem } from "@/lib/admin/dashboard";
import { hrefWith, str } from "@/lib/admin/params";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Live activity" };

const KINDS: { value: ActivityItem["kind"]; label: string; tone: "gold" | "indigo" | "neutral" | "success" | "danger" | "turquoise" | "terracotta" }[] = [
  { value: "order", label: "Orders", tone: "gold" },
  { value: "audit", label: "Staff actions", tone: "indigo" },
  { value: "signup", label: "Signups", tone: "turquoise" },
  { value: "review", label: "Reviews", tone: "success" },
  { value: "application", label: "Applications", tone: "terracotta" },
  { value: "dispute", label: "Disputes", tone: "danger" },
  { value: "message", label: "Support", tone: "neutral" },
];

export default async function ActivityPage(props: PageProps<"/admin/activity">) {
  await requireStaff("dashboard.view");
  const params = await props.searchParams;
  const kind = str(params, "kind") as ActivityItem["kind"] | "";
  const beforeStr = str(params, "before");
  const before = beforeStr && !Number.isNaN(Date.parse(beforeStr)) ? new Date(beforeStr) : null;
  const q = str(params, "q").toLowerCase();
  const limit = 60;
  let feed = await activityFeed({ kinds: kind ? [kind] : undefined, limit, before });
  if (q) feed = feed.filter((f) => `${f.title} ${f.detail ?? ""} ${f.actor ?? ""}`.toLowerCase().includes(q));
  const last = feed.at(-1);
  const tone = (k: string) => KINDS.find((x) => x.value === k)?.tone ?? "neutral";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Overview" title="Live activity" description="Order events, staff actions, signups, reviews, applications, disputes and support messages — newest first." />
      <Tabs
        items={[{ label: "Everything", href: hrefWith("/admin/activity", params, { kind: null, before: null }), active: !kind }, ...KINDS.map((k) => ({ label: k.label, href: hrefWith("/admin/activity", params, { kind: k.value, before: null }), active: kind === k.value }))]}
      />
      <form method="get" className="flex gap-2">
        {kind ? <input type="hidden" name="kind" value={kind} /> : null}
        <input name="q" defaultValue={q} placeholder="Filter this page by text…" data-admin-search className="h-9 w-72 rounded-full border border-umber-200 bg-white/90 px-4 text-sm focus:border-gold-500 focus:outline-none" />
        <button className="h-9 rounded-full bg-indigo-900 px-4 text-sm text-sand-50">Filter</button>
      </form>
      <TableCard
        footer={
          <div className="flex items-center justify-between text-sm">
            {before ? <Link href={hrefWith("/admin/activity", params, { before: null })} className="text-terracotta-600 hover:underline">← Newest</Link> : <span />}
            {last && feed.length >= limit / 2 ? (
              <Link href={hrefWith("/admin/activity", params, { before: last.at.toISOString() })} className="text-terracotta-600 hover:underline">
                Older →
              </Link>
            ) : (
              <span className="text-umber-400">End of feed</span>
            )}
          </div>
        }
      >
        {feed.length ? (
          <ul className="divide-y divide-umber-200/60">
            {feed.map((f) => (
              <li key={f.id} className="flex items-start gap-4 px-5 py-3 text-sm">
                <Badge tone={tone(f.kind)} className="mt-0.5 w-24 justify-center">
                  {KINDS.find((k) => k.value === f.kind)?.label ?? f.kind}
                </Badge>
                <div className="min-w-0 flex-1">
                  {f.href ? (
                    <Link href={f.href} className="font-medium text-umber-900 hover:text-terracotta-600">
                      {f.title}
                    </Link>
                  ) : (
                    <p className="font-medium text-umber-900">{f.title}</p>
                  )}
                  {f.detail ? <p className="text-umber-500">{f.detail}</p> : null}
                </div>
                <div className="shrink-0 text-right text-xs text-umber-500">
                  <p title={formatDateTime(f.at)}>{timeAgo(f.at)}</p>
                  {f.actor ? <p className="text-umber-400">{f.actor}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-12 text-center text-sm text-umber-500">No activity matches.</p>
        )}
      </TableCard>
    </div>
  );
}
