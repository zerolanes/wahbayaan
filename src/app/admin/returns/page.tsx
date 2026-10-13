import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { decideReturnAction, refundReturnAction, returnStepAction } from "@/app/actions/admin/fulfilment";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, TextInput } from "@/components/admin/controls";
import { DemoBadge, Empty, OrderAmount, StatusBadge, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader, Tabs } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { hubs, orders, returnRequests } from "@/lib/db/schema";
import { str } from "@/lib/admin/params";
import { minorToInput } from "@/lib/admin/money";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Returns" };

const TABS = [
  { value: "", label: "Open", statuses: ["requested", "approved", "in_transit", "received"] as const },
  { value: "done", label: "Closed", statuses: ["refunded", "rejected", "closed"] as const },
];

const DEST: Record<string, string> = { seller: "Back to the seller", hub: "To our hub", forwarder: "To the forwarder" };

export default async function ReturnsPage(props: PageProps<"/admin/returns">) {
  const user = await requireStaff("orders.manage");
  const params = await props.searchParams;
  const tab = TABS.find((t) => t.value === str(params, "tab")) ?? TABS[0];
  const d = await db();
  const rows = await d
    .select({ r: returnRequests, o: orders, hubName: hubs.name })
    .from(returnRequests)
    .innerJoin(orders, eq(orders.id, returnRequests.orderId))
    .leftJoin(hubs, eq(hubs.id, returnRequests.returnHubId))
    .where(inArray(returnRequests.status, [...tab.statuses]))
    .orderBy(desc(returnRequests.createdAt));
  const canRefund = user.permissions.has("orders.refund");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Fulfilment" title="Returns" description="Buyers request returns from their order page within the protection window. Domestic items go back to the seller; international ones to our hub or forwarder. Refunds use the normal refund flow." />
      <Tabs items={TABS.map((t) => ({ label: t.label, href: t.value ? `/admin/returns?tab=${t.value}` : "/admin/returns", active: t === tab }))} />
      {rows.length ? (
        <div className="space-y-4">
          {rows.map(({ r, o, hubName }) => (
            <section key={r.id} className="rounded-2xl border border-umber-200 bg-white p-4" data-return={r.number}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    <span className="font-mono">{r.number}</span> ·{" "}
                    <Link href={`/admin/orders/${o.number}`} className="text-indigo-800 hover:underline">
                      {o.number}
                    </Link>{" "}
                    <DemoBadge show={o.isDemo} /> · {o.customerName}
                  </p>
                  <p className="text-sm text-umber-600">
                    {r.items.map((i) => `${i.qty} × ${i.title}`).join(", ")} · {r.reason.replaceAll("_", " ")} · requested {formatDate(r.createdAt)}
                  </p>
                  <p className="mt-1 text-sm text-umber-800">“{r.description}”</p>
                  {r.photos.length ? (
                    <div className="mt-2 flex gap-2">
                      {r.photos.map((u) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt="Return photo" className="size-14 rounded-lg object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs text-umber-500">
                    {DEST[r.destination] ?? r.destination}
                    {hubName ? ` (${hubName})` : ""} · paid <OrderAmount amount={o.total} currency={o.currency} />
                    {r.trackingNumber ? ` · ${r.courier ?? ""} ${r.trackingNumber}` : ""}
                  </p>
                </div>
                <StatusBadge kind="returnRequest" status={r.status} />
              </div>
              {r.status === "requested" ? (
                <ActionForm action={decideReturnAction} inline className="mt-3 flex flex-wrap items-end gap-2 border-t border-umber-200 pt-3">
                  <input type="hidden" name="id" value={r.id} />
                  <FieldRow label="Note to the buyer" htmlFor={`rn-${r.id}`} className="min-w-72 flex-1">
                    <TextInput id={`rn-${r.id}`} name="note" />
                  </FieldRow>
                  <SubmitButton name="decision" value="approve">
                    Approve return
                  </SubmitButton>
                  <SubmitButton name="decision" value="reject" variant="outline">
                    Reject
                  </SubmitButton>
                </ActionForm>
              ) : null}
              {r.status === "approved" ? (
                <ActionForm action={returnStepAction} inline className="mt-3 flex flex-wrap items-end gap-2 border-t border-umber-200 pt-3">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="step" value="in_transit" />
                  <FieldRow label="Return courier" htmlFor={`rc-${r.id}`}>
                    <TextInput id={`rc-${r.id}`} name="courier" />
                  </FieldRow>
                  <FieldRow label="Tracking" htmlFor={`rt-${r.id}`}>
                    <TextInput id={`rt-${r.id}`} name="trackingNumber" />
                  </FieldRow>
                  <SubmitButton variant="outline">On its way back</SubmitButton>
                </ActionForm>
              ) : null}
              {r.status === "approved" || r.status === "in_transit" ? (
                <ActionForm action={returnStepAction} className="mt-2 inline-flex">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="step" value="received" />
                  <SubmitButton variant="outline">Mark received</SubmitButton>
                </ActionForm>
              ) : null}
              {["approved", "in_transit", "received"].includes(r.status) && canRefund ? (
                <ActionForm action={refundReturnAction} inline className="mt-3 flex flex-wrap items-end gap-2 border-t border-umber-200 pt-3">
                  <input type="hidden" name="id" value={r.id} />
                  <FieldRow label={`Refund (${o.currency})`} htmlFor={`rr-${r.id}`}>
                    <TextInput id={`rr-${r.id}`} name="amount" inputMode="decimal" defaultValue={minorToInput(o.itemsSubtotal)} />
                  </FieldRow>
                  <SubmitButton variant="accent" confirm="Refund this amount to the buyer's original payment method?">
                    Refund
                  </SubmitButton>
                  {r.status !== "received" ? <Badge tone="pending">Not received yet</Badge> : null}
                </ActionForm>
              ) : null}
            </section>
          ))}
        </div>
      ) : (
        <TableCard>
          <Empty>No returns here.</Empty>
        </TableCard>
      )}
    </div>
  );
}
