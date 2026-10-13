import Link from "next/link";
import { shipmentDeliveredAction } from "@/app/actions/admin/fulfilment";
import { ActionButton } from "./action-form";
import { KV, Panel, StatusBadge } from "./ui";
import { Badge } from "@/components/ui/misc";
import { orderMoney } from "@/lib/admin/money";
import { getOrderFulfilmentView } from "@/lib/fulfilment/service";
import { formatDate } from "@/lib/utils/format";

/** Admin order page: how the order is fulfilled (direct parcels or hub consolidation), with shipments, extra charges and returns. */
export async function FulfilmentPanel({ orderId, orderNumber, currency, canOperate }: { orderId: string; orderNumber: string; currency: string; canOperate: boolean }) {
  const v = await getOrderFulfilmentView(orderId);
  if (!v.fulfilment && !v.shipments.length && !v.returns.length) return null;
  const hubMode = v.fulfilment?.mode === "hub";
  return (
    <Panel
      title={hubMode ? `Fulfilment — consolidated at ${v.hub?.name ?? "hub"}` : "Fulfilment — direct from each seller"}
      action={hubMode && canOperate ? <Link href={`/admin/hub/pack/${orderNumber}`} className="text-sm text-terracotta-600 hover:underline">Pack & ship →</Link> : null}
    >
      <KV
        items={[
          ["Route", hubMode ? `Sellers → ${v.hub?.name} (${v.hub?.city}) → buyer, one box` : "Each seller ships straight to the buyer"],
          ["Estimated dispatch", v.fulfilment?.estimatedDispatchAt ? formatDate(v.fulfilment.estimatedDispatchAt) : <Badge key="e" tone="pending">Pending</Badge>],
          ...(hubMode ? ([["Arrived", v.progress.label]] as [string, string][]) : []),
          ...(v.fulfilment?.decision ? ([["Decision", v.fulfilment.decision === "wait" ? "Wait for all items" : "Ship ready items now"]] as [string, string][]) : []),
        ]}
      />
      {v.parcels.length ? (
        <ul className="mt-4 divide-y divide-umber-100 text-sm">
          {v.parcels.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <a href={`/labels/${p.reference}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-indigo-800 underline">
                  {p.reference}
                </a>{" "}
                · {p.senderLabel} → hub{p.trackingNumber ? ` · ${p.courier} ${p.trackingNumber}` : p.courier ? ` · ${p.courier}` : ""}
                {p.bin ? ` · bin ${p.bin}` : ""}
              </span>
              <StatusBadge kind="hubParcel" status={p.status} />
            </li>
          ))}
        </ul>
      ) : null}
      {v.shipments.length ? (
        <ul className="mt-4 divide-y divide-umber-100 border-t border-umber-200 text-sm">
          {v.shipments.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <a href={`/labels/${s.reference}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-indigo-800 underline">
                  {s.reference}
                </a>{" "}
                · {s.kind === "direct" ? "direct parcel" : s.kind === "partial" ? "part shipment" : "consolidated box"} · {s.courierName} <code>{s.trackingNumber}</code>
                {s.provider === "sandbox" ? <Badge tone="pending" className="ml-1">Sandbox</Badge> : null}
              </span>
              <span className="flex items-center gap-2">
                <StatusBadge kind="shipment" status={s.status} />
                {canOperate && s.status === "shipped" && s.kind !== "direct" ? (
                  <ActionButton action={shipmentDeliveredAction} fields={{ shipmentId: s.id }} confirm="Mark this box delivered? The buyer-protection window starts now.">
                    Mark delivered
                  </ActionButton>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {v.quotes.length ? (
        <div className="mt-4 border-t border-umber-200 pt-3 text-sm">
          <p className="text-xs font-semibold tracking-wide text-umber-500 uppercase">Extra shipping</p>
          {v.quotes.map((q) => (
            <p key={q.id} className="flex justify-between gap-2">
              <span>
                {orderMoney(q.amount, currency)} — {q.kind === "partial_shipment" ? "second box" : "heavier box"}
              </span>
              <StatusBadge kind="fulfilmentQuote" status={q.status} />
            </p>
          ))}
        </div>
      ) : null}
      {v.returns.length ? (
        <div className="mt-4 border-t border-umber-200 pt-3 text-sm">
          <p className="text-xs font-semibold tracking-wide text-umber-500 uppercase">Returns</p>
          {v.returns.map((r) => (
            <p key={r.id} className="flex justify-between gap-2">
              <Link href="/admin/returns" className="font-mono text-indigo-800 hover:underline">
                {r.number}
              </Link>
              <StatusBadge kind="returnRequest" status={r.status} />
            </p>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
