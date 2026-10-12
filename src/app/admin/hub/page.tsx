import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ScanLine } from "lucide-react";
import {
  consolidationDecisionAction,
  parcelDueAction,
  qcParcelAction,
  receiveParcelAction,
  remindSellerAction,
  sendBackAction,
  setBinAction,
  shipmentDeliveredAction,
} from "@/app/actions/admin/fulfilment";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, TextInput } from "@/components/admin/controls";
import { DemoBadge, Empty, FilterSelect, MiniStat, StatusBadge, TableCard } from "@/components/admin/ui";
import { Badge, Notice, PageHeader, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { hubs } from "@/lib/db/schema";
import { hrefWith, str } from "@/lib/admin/params";
import { ageDays, consolidationProgress, isParcelLate, partialShipmentCheck } from "@/lib/fulfilment/consolidation";
import { consolidationBoard, hubParcelList, shippedBoxes } from "@/lib/fulfilment/service";
import { destinationName } from "@/lib/money/currency";
import { getSetting } from "@/lib/settings";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Hub operations" };

const TABS = [
  { value: "inbound", label: "Inbound" },
  { value: "qc", label: "QC" },
  { value: "storage", label: "Storage" },
  { value: "consolidation", label: "Consolidation" },
  { value: "shipped", label: "Shipped" },
] as const;

export default async function HubOpsPage(props: PageProps<"/admin/hub">) {
  await requireStaff("hub.operate");
  const params = await props.searchParams;
  const tab = (TABS.find((t) => t.value === str(params, "tab"))?.value ?? "inbound") as (typeof TABS)[number]["value"];
  const hubId = str(params, "hub") || null;
  const d = await db();
  const [hubRows, setting, inbound, qc, stored, board, shipped] = await Promise.all([
    d.select().from(hubs).where(eq(hubs.isActive, true)).orderBy(asc(hubs.name)),
    getSetting("fulfilment"),
    hubParcelList(["expected", "in_transit"], hubId),
    hubParcelList(["received", "qc_failed"], hubId),
    hubParcelList(["qc_passed"], hubId),
    consolidationBoard(hubId),
    shippedBoxes(),
  ]);
  const now = new Date();
  const counts: Record<string, number> = { inbound: inbound.length, qc: qc.length, storage: stored.length, consolidation: board.length, shipped: shipped.filter((s) => s.s.status === "shipped").length };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fulfilment"
        title="Hub operations"
        description="Receive sellers' parcels, check them, store them and ship one box per order once everything has arrived."
        actions={
          hubRows.length > 1 ? (
            <form method="get" className="flex gap-2">
              <input type="hidden" name="tab" value={tab} />
              <FilterSelect name="hub" label="Hub" value={hubId ?? ""} options={hubRows.map((h) => ({ value: h.id, label: h.name }))} />
              <button className="h-9 rounded-lg bg-umber-900 px-3 text-sm text-white">Go</button>
            </form>
          ) : null
        }
      />
      {!hubRows.length ? (
        <Notice tone="pending" title="No active hub">
          Activate a hub in <Link href="/admin/hubs" className="underline">Hubs & booking</Link> to consolidate international orders.
        </Notice>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-5">
        {TABS.map((t) => (
          <MiniStat key={t.value} label={t.label} value={counts[t.value] ?? 0} href={hrefWith("/admin/hub", params, { tab: t.value })} />
        ))}
      </div>
      <Tabs items={TABS.map((t) => ({ label: t.label, href: hrefWith("/admin/hub", params, { tab: t.value }), active: tab === t.value, count: counts[t.value] }))} />

      {tab === "inbound" ? (
        <>
          <ActionForm action={receiveParcelAction} resetOnSuccess inline className="flex flex-wrap items-end gap-3 rounded-2xl border border-umber-200 bg-white p-4">
            <FieldRow label="Scan or type the parcel reference (or courier tracking number)" htmlFor="scan" className="min-w-72 flex-1">
              <TextInput id="scan" name="reference" autoFocus required placeholder="WB-XXXXXX-P1X" className="font-mono" />
            </FieldRow>
            <FieldRow label="Weight on arrival (kg, optional)" htmlFor="scan-kg">
              <TextInput id="scan-kg" name="weightKg" inputMode="decimal" className="w-32" />
            </FieldRow>
            <SubmitButton>
              <ScanLine className="size-4" /> Receive
            </SubmitButton>
          </ActionForm>
          <TableCard>
            {inbound.length ? (
              <Table>
                <THead>
                  <tr>
                    <Th>Reference</Th>
                    <Th>From</Th>
                    <Th>Order</Th>
                    <Th>Courier to hub</Th>
                    <Th>Due</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </THead>
                <TBody>
                  {inbound.map(({ p, orderNumber, isDemo }) => {
                    const late = isParcelLate({ id: p.id, status: p.status, itemCount: 1, expectedBy: p.expectedBy }, now, setting.lateThresholdDays);
                    return (
                      <Tr key={p.id}>
                        <Td className="font-mono text-xs">{p.reference}</Td>
                        <Td>
                          {p.senderLabel}
                          <p className="text-xs text-umber-500">{p.senderCity ?? "—"}</p>
                        </Td>
                        <Td>
                          <Link href={`/admin/orders/${orderNumber}`} className="text-indigo-800 hover:underline">
                            {orderNumber}
                          </Link>{" "}
                          <DemoBadge show={isDemo} />
                        </Td>
                        <Td className="text-sm">
                          {p.courier ?? "—"}
                          {p.trackingNumber ? <p className="font-mono text-xs">{p.trackingNumber}</p> : null}
                        </Td>
                        <Td className="text-sm whitespace-nowrap">
                          {p.expectedBy ? formatDate(p.expectedBy) : <Badge tone="pending">Not stated</Badge>}
                          {late ? (
                            <p>
                              <Badge tone="danger">Late</Badge>
                            </p>
                          ) : null}
                        </Td>
                        <Td>
                          <StatusBadge kind="hubParcel" status={p.status} />
                        </Td>
                        <Td>
                          <ActionButton action={receiveParcelAction} fields={{ reference: p.reference }}>
                            Receive
                          </ActionButton>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            ) : (
              <Empty>Nothing expected.</Empty>
            )}
          </TableCard>
        </>
      ) : null}

      {tab === "qc" ? (
        <div className="space-y-4">
          {qc.length ? (
            qc.map(({ p, orderNumber }) => (
              <section key={p.id} className="rounded-2xl border border-umber-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      <span className="font-mono text-sm">{p.reference}</span> · {p.senderLabel} ·{" "}
                      <Link href={`/admin/orders/${orderNumber}`} className="text-indigo-800 hover:underline">
                        {orderNumber}
                      </Link>
                    </p>
                    <p className="text-xs text-umber-500">
                      Received {formatDate(p.receivedAt)}
                      {p.measuredWeightG ? ` · ${(p.measuredWeightG / 1000).toFixed(2)} kg` : ""}
                    </p>
                    {p.qcNotes ? <p className="mt-1 text-sm text-danger-700">{p.qcNotes}</p> : null}
                    {p.qcPhotos.length ? (
                      <div className="mt-2 flex gap-2">
                        {p.qcPhotos.map((u) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt="QC photo" className="size-14 rounded-lg object-cover" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <StatusBadge kind="hubParcel" status={p.status} />
                </div>
                <ActionForm action={qcParcelAction} inline className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_1fr_auto] sm:items-end">
                  <input type="hidden" name="parcelId" value={p.id} />
                  <FieldRow label="Notes (required if it fails)" htmlFor={`qcn-${p.id}`}>
                    <TextInput id={`qcn-${p.id}`} name="notes" placeholder="Condition, matches the listing, packing…" />
                  </FieldRow>
                  <FieldRow label="Bin / shelf" htmlFor={`bin-${p.id}`}>
                    <TextInput id={`bin-${p.id}`} name="bin" placeholder="A-03" />
                  </FieldRow>
                  <FieldRow label="Photos" htmlFor={`ph-${p.id}`}>
                    <input id={`ph-${p.id}`} type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple className="text-sm" />
                  </FieldRow>
                  <div className="flex gap-2">
                    <SubmitButton name="result" value="pass">
                      QC pass
                    </SubmitButton>
                    <SubmitButton name="result" value="fail" variant="danger">
                      Fail
                    </SubmitButton>
                  </div>
                </ActionForm>
                {p.status === "qc_failed" ? (
                  <ActionForm action={sendBackAction} inline className="mt-3 flex flex-wrap items-end gap-2 border-t border-umber-200 pt-3">
                    <input type="hidden" name="parcelId" value={p.id} />
                    <FieldRow label="Send back to the seller to put right" htmlFor={`sb-${p.id}`} className="min-w-72 flex-1">
                      <TextInput id={`sb-${p.id}`} name="note" required placeholder="What the seller agreed to do" />
                    </FieldRow>
                    <SubmitButton variant="outline">Send back</SubmitButton>
                  </ActionForm>
                ) : null}
              </section>
            ))
          ) : (
            <TableCard>
              <Empty>Nothing waiting for QC.</Empty>
            </TableCard>
          )}
        </div>
      ) : null}

      {tab === "storage" ? (
        <TableCard>
          {stored.length ? (
            <Table>
              <THead>
                <tr>
                  <Th>Reference</Th>
                  <Th>From</Th>
                  <Th>Order</Th>
                  <Th>Checked</Th>
                  <Th>Bin / shelf</Th>
                </tr>
              </THead>
              <TBody>
                {stored.map(({ p, orderNumber }) => (
                  <Tr key={p.id}>
                    <Td className="font-mono text-xs">{p.reference}</Td>
                    <Td>{p.senderLabel}</Td>
                    <Td>
                      <Link href={`/admin/orders/${orderNumber}`} className="text-indigo-800 hover:underline">
                        {orderNumber}
                      </Link>
                    </Td>
                    <Td className="text-sm">{formatDate(p.qcAt)}</Td>
                    <Td>
                      <ActionForm action={setBinAction} className="flex gap-2">
                        <input type="hidden" name="parcelId" value={p.id} />
                        <TextInput name="bin" defaultValue={p.bin ?? ""} aria-label={`Bin for ${p.reference}`} className="w-24" />
                        <SubmitButton variant="ghost">Save</SubmitButton>
                      </ActionForm>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <Empty>Nothing in storage.</Empty>
          )}
        </TableCard>
      ) : null}

      {tab === "consolidation" ? (
        <div className="space-y-4">
          {board.length ? (
            board.map(({ o, f, parcels }) => {
              const prog = consolidationProgress(parcels);
              const partial = partialShipmentCheck(parcels, now, setting.lateThresholdDays);
              const lateParcels = parcels.filter((p) => isParcelLate(p, now, setting.lateThresholdDays));
              const canPack = prog.readyToPack || (f.decision === "ship_partial" && prog.readyItems > 0);
              return (
                <section key={o.id} className="rounded-2xl border border-umber-200 bg-white p-4" data-order={o.number}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        <Link href={`/admin/orders/${o.number}`} className="text-indigo-800 hover:underline">
                          {o.number}
                        </Link>{" "}
                        <DemoBadge show={o.isDemo} /> · {o.customerName} → {destinationName(o.destinationCountry)}
                      </p>
                      <p className="text-sm text-umber-600">
                        <strong>{prog.label}</strong> · {prog.readyItems} checked · waiting {ageDays(o.paidAt, now) ?? 0} days · est. dispatch{" "}
                        {f.estimatedDispatchAt ? formatDate(f.estimatedDispatchAt) : <Badge tone="pending">Pending</Badge>}
                        {f.decision ? (
                          <>
                            {" "}
                            · <Badge tone={f.decision === "wait" ? "gold" : "turquoise"}>{f.decision === "wait" ? "Waiting for all" : "Ship ready items"}</Badge>
                          </>
                        ) : null}
                      </p>
                    </div>
                    {canPack ? (
                      <Link href={`/admin/hub/pack/${o.number}`} className="inline-flex h-9 items-center rounded-full bg-umber-900 px-4 text-sm font-medium text-white">
                        Pack &amp; ship →
                      </Link>
                    ) : null}
                  </div>
                  <ul className="mt-3 divide-y divide-umber-100 text-sm">
                    {parcels.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span>
                          <span className="font-mono text-xs">{p.reference}</span> · {p.senderLabel} · {p.itemCount} item{p.itemCount === 1 ? "" : "s"}
                          {p.bin ? <span className="text-umber-500"> · bin {p.bin}</span> : null}
                        </span>
                        <span className="flex items-center gap-2">
                          {lateParcels.some((l) => l.id === p.id) ? <Badge tone="danger">Late</Badge> : null}
                          <StatusBadge kind="hubParcel" status={p.status} />
                          {["expected", "in_transit"].includes(p.status) ? (
                            <ActionForm action={parcelDueAction} className="flex items-center gap-1">
                              <input type="hidden" name="parcelId" value={p.id} />
                              <TextInput type="date" name="due" aria-label={`Seller's hand-over date for ${p.reference}`} defaultValue={p.expectedBy ? p.expectedBy.toISOString().slice(0, 10) : ""} className="w-36" />
                              <SubmitButton variant="ghost">Set due</SubmitButton>
                            </ActionForm>
                          ) : null}
                          {lateParcels.some((l) => l.id === p.id) && p.vendorOrderId ? (
                            <ActionButton action={remindSellerAction} fields={{ vendorOrderId: p.vendorOrderId, orderNumber: o.number }} variant="ghost">
                              Remind seller
                            </ActionButton>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {lateParcels.length ? (
                    <ActionForm action={consolidationDecisionAction} inline className="mt-3 flex flex-wrap items-end gap-2 border-t border-umber-200 pt-3">
                      <input type="hidden" name="orderId" value={o.id} />
                      <FieldRow label="Note to the buyer (optional)" htmlFor={`dn-${o.id}`} className="min-w-72 flex-1">
                        <TextInput id={`dn-${o.id}`} name="note" />
                      </FieldRow>
                      <SubmitButton name="decision" value="wait" variant="outline">
                        Wait for all items
                      </SubmitButton>
                      <SubmitButton name="decision" value="ship_partial" disabled={!partial.allowed} title={partial.allowed ? undefined : partial.reason}>
                        Ship ready items now
                      </SubmitButton>
                    </ActionForm>
                  ) : null}
                </section>
              );
            })
          ) : (
            <TableCard>
              <Empty>No orders consolidating.</Empty>
            </TableCard>
          )}
        </div>
      ) : null}

      {tab === "shipped" ? (
        <TableCard>
          {shipped.length ? (
            <Table>
              <THead>
                <tr>
                  <Th>Shipment</Th>
                  <Th>Order</Th>
                  <Th>Courier & tracking</Th>
                  <Th>Box</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </THead>
              <TBody>
                {shipped.map(({ s, orderNumber, destination, customer }) => (
                  <Tr key={s.id}>
                    <Td className="font-mono text-xs">
                      {s.reference}
                      {s.kind === "partial" ? (
                        <p>
                          <Badge tone="gold">Partial</Badge>
                        </p>
                      ) : null}
                    </Td>
                    <Td>
                      <Link href={`/admin/orders/${orderNumber}`} className="text-indigo-800 hover:underline">
                        {orderNumber}
                      </Link>
                      <p className="text-xs text-umber-500">
                        {customer} → {destinationName(destination)}
                      </p>
                    </Td>
                    <Td className="text-sm">
                      {s.courierName}
                      <p className="font-mono text-xs">{s.trackingNumber}</p>
                    </Td>
                    <Td className="text-sm whitespace-nowrap">
                      {s.chargeableWeightG ? `${(s.chargeableWeightG / 1000).toFixed(2)} kg chargeable` : "—"}
                      <p className="text-xs">
                        <a href={`/labels/${s.reference}`} target="_blank" rel="noreferrer" className="underline">
                          Label
                        </a>{" "}
                        ·{" "}
                        <Link href={`/admin/orders/${orderNumber}/invoice?shipment=${s.reference}`} className="underline">
                          Invoice & packing list
                        </Link>
                      </p>
                    </Td>
                    <Td>
                      <StatusBadge kind="shipment" status={s.status} />
                    </Td>
                    <Td>
                      {s.status === "shipped" ? (
                        <ActionButton action={shipmentDeliveredAction} fields={{ shipmentId: s.id }} confirm="Mark delivered? The buyer-protection window starts now.">
                          Mark delivered
                        </ActionButton>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <Empty>Nothing shipped from a hub yet.</Empty>
          )}
        </TableCard>
      ) : null}
    </div>
  );
}
