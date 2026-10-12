import { notFound } from "next/navigation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { updateHubAction } from "@/app/actions/admin/fulfilment";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { HubFields } from "@/components/admin/hub-fields";
import { DemoBadge, MiniStat, Panel } from "@/components/admin/ui";
import { Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { couriers, hubParcels, hubs } from "@/lib/db/schema";
import { hubAddressIsPlaceholder } from "@/lib/fulfilment/service";

export const metadata = { title: "Hub" };

export default async function HubPage(props: PageProps<"/admin/hubs/[id]">) {
  await requireStaff("hubs.manage");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await db();
  const hub = await d.query.hubs.findFirst({ where: eq(hubs.id, id) });
  if (!hub) notFound();
  const [courierRows, [stats]] = await Promise.all([
    d.select({ id: couriers.id, name: couriers.name }).from(couriers).orderBy(asc(couriers.name)),
    d
      .select({
        inbound: sql<number>`count(*) filter (where ${hubParcels.status} in ('expected','in_transit'))::int`,
        stored: sql<number>`count(*) filter (where ${hubParcels.status} in ('received','qc_passed','qc_failed'))::int`,
      })
      .from(hubParcels)
      .where(and(eq(hubParcels.hubId, hub.id), inArray(hubParcels.status, ["expected", "in_transit", "received", "qc_passed", "qc_failed"]))),
  ]);
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Hubs & booking", href: "/admin/hubs" }, { label: hub.name }]} />
      <PageHeader eyebrow="Fulfilment" title={hub.name} description={`${hub.city}, ${hub.country}`} actions={<DemoBadge show={hub.isDemo} />} />
      {hub.isDemo ? (
        <Notice tone="pending" title="Demo hub">
          Fictional, for trying the flow. Add the real site (or switch this off and add a new hub) once the owner has chosen a location.
        </Notice>
      ) : null}
      {hubAddressIsPlaceholder(hub) ? <Notice tone="gold" title="Address still has placeholders">Sellers see this address on their hub labels — fill in the [Add: …] fields.</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <MiniStat label="Expected / on the way" value={Number(stats?.inbound ?? 0)} href="/admin/hub?tab=inbound" />
        <MiniStat label="At the hub" value={Number(stats?.stored ?? 0)} href="/admin/hub?tab=storage" />
      </div>
      <Panel title="Details">
        <ActionForm action={updateHubAction} inline className="space-y-4">
          <input type="hidden" name="id" value={hub.id} />
          <HubFields hub={hub} couriers={courierRows} idPrefix="edit" />
          <SubmitButton>Save hub</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
