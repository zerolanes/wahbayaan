import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-form";
import { flag, placeLabel } from "@/components/admin/analytics";
import { DetailGrid, KV, Panel } from "@/components/admin/ui";
import { CopyButton } from "@/components/admin/client-bits";
import { Badge, Breadcrumbs, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { getVisitJourney } from "@/lib/analytics/stats";
import { deleteConsentDataAction, deleteVisitAction } from "@/app/actions/admin/analytics";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Visitor journey" };

function gap(a: Date, b: Date) {
  const s = Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default async function VisitPage(props: PageProps<"/admin/analytics/visits/[id]">) {
  const user = await requireStaff("analytics.view");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const j = await getVisitJourney(id);
  if (!j) notFound();
  const { visit: v, views, others } = j;
  const canManage = user.permissions.has("analytics.manage");
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Visitor journeys", href: "/admin/analytics/visits" }, { label: formatDateTime(v.startedAt) }]} />
      <PageHeader
        eyebrow="Insights"
        title="Visitor journey"
        description={`${views.length} page views · ${flag(v.countryCode)} ${placeLabel(v)}`}
        actions={
          canManage ? (
            <ActionButton action={deleteVisitAction} fields={{ id: v.id }} variant="danger" confirm="Delete this visit and its page views?">
              Delete visit
            </ActionButton>
          ) : null
        }
      />
      <DetailGrid
        main={
          <Panel title="Timeline">
            <ol className="relative space-y-0 border-l border-umber-200 pl-5">
              {views.map((p, i) => (
                <li key={p.id} className="relative pb-5 last:pb-0">
                  <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-white bg-umber-900" aria-hidden />
                  <p className="text-xs text-umber-500">
                    {formatDateTime(p.createdAt)}
                    {i > 0 ? <span> · +{gap(views[i - 1].createdAt, p.createdAt)}</span> : null}
                  </p>
                  <p className="mt-0.5 font-medium text-umber-900">
                    <code className="text-sm">{p.path}</code>
                  </p>
                  {p.title ? <p className="text-sm text-umber-600">{p.title}</p> : null}
                  {p.referrer ? <p className="text-xs text-umber-500">from {p.referrer}</p> : null}
                </li>
              ))}
            </ol>
            <p className="mt-5 text-xs text-umber-500">Last activity {formatDateTime(v.lastSeenAt)} (heartbeats while the tab is visible).</p>
          </Panel>
        }
        side={
          <>
            <Panel title="Visit">
              <KV
                items={[
                  ["Consent id", <span key="c" className="inline-flex items-center gap-2"><code className="text-xs">{v.consentId}</code><CopyButton value={v.consentId} /></span>],
                  ["Landing page", <code key="l" className="text-xs">{v.landingPath}</code>],
                  ["Source", v.referrer ?? "Direct"],
                  ["Location", <span key="g">{flag(v.countryCode)} {[v.city, v.region, v.country].filter(Boolean).join(", ") || "Unknown"}</span>],
                  ["Coordinates", v.latitude != null && v.longitude != null ? `${v.latitude.toFixed(2)}, ${v.longitude.toFixed(2)}` : "—"],
                  ["Network", v.isDatacenter ? <Badge key="d" tone="pending">Datacenter / proxy</Badge> : "Residential or unknown"],
                  ["Device", `${v.device ?? "—"} · ${v.os ?? "—"} · ${v.browser ?? "—"}`],
                  ["Screen", v.screen ?? "—"],
                  ["Language", v.language ?? "—"],
                ]}
              />
            </Panel>
            <Panel title="Same visitor" description="Other visits with this consent id.">
              {others.length ? (
                <ul className="space-y-2 text-sm">
                  {others.map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/analytics/visits/${o.id}`} className="underline-offset-2 hover:underline">
                        {formatDateTime(o.startedAt)}
                      </Link>{" "}
                      <span className="text-umber-500">· {o.pageCount} pages · {o.landingPath}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-umber-500">No other visits.</p>
              )}
              <p className="mt-4 text-sm">
                <Link className="underline" href={`/admin/analytics/consent?q=${encodeURIComponent(v.consentId)}`}>
                  Consent decisions for this id
                </Link>
              </p>
              {canManage ? (
                <div className="mt-4 border-t border-umber-200 pt-4">
                  <ActionButton action={deleteConsentDataAction} fields={{ consentId: v.consentId }} variant="outline" confirm="Delete every visit stored for this consent id?">
                    Delete all visits of this visitor
                  </ActionButton>
                </div>
              ) : null}
            </Panel>
          </>
        }
      />
    </div>
  );
}
