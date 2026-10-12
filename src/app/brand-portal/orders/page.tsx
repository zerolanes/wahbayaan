import { markItemsReady } from "@/app/actions/brand-portal";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { TextInput } from "@/components/admin/controls";
import { Empty, Panel, StatusBadge } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, PageHeader } from "@/components/ui/misc";
import { requireBrandMember } from "@/lib/brand-portal/access";
import { portalOrders } from "@/lib/brand-portal/queries";
import { formatDate, formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Orders" };

const FULFILMENT_LABEL: Record<string, string> = {
  pending: "Waiting for your items",
  ordered_from_brand: "Requested from you",
  received_at_wahbayaan: "Received by Wahbayaan",
  quality_checked: "Checked by Wahbayaan",
  dispatched: "On its way to the buyer",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/**
 * Paid orders containing this brand's products. The brand prepares the items
 * and marks them ready; Wahbayaan collects, delivers and looks after the buyer.
 */
export default async function PortalOrders() {
  const user = await requireBrandMember();
  const groups = await portalOrders(user.brandId);
  const open = groups.filter((g) => g.canPrepare);
  const past = groups.filter((g) => !g.canPrepare);

  const card = (g: (typeof groups)[number]) => {
    const total = g.items.reduce((a, x) => a + (x.item.unitPricePkr ?? 0) * x.item.qty, 0);
    const pending = g.items.filter((x) => !x.readyAt);
    return (
      <Panel
        key={g.order.id}
        title={
          <span className="flex flex-wrap items-center gap-2">
            Order {g.order.number} <StatusBadge kind="order" status={g.order.status} />
          </span>
        }
        description={`Paid ${formatDate(g.order.paidAt ?? g.order.createdAt)} · ${g.fulfilment ? FULFILMENT_LABEL[g.fulfilment.status] : "Waiting for your items"}`}
        action={
          <span className="text-sm">
            Your items: <SellerPrice pkr={total} className="font-semibold" />
          </span>
        }
      >
        <ActionForm action={markItemsReady} className="space-y-3">
          <ul className="divide-y divide-umber-100">
            {g.items.map(({ item, readyAt }) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                {g.canPrepare && !readyAt ? (
                  <input type="checkbox" name="itemIds" value={item.id} defaultChecked aria-label={`Mark ${item.title} ready`} className="size-4" />
                ) : (
                  <span className="w-4" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{item.title}</span>
                  <span className="block text-xs text-umber-500">{[item.size, item.colour, item.sku].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="tabular-nums">×{item.qty}</span>
                <SellerPrice pkr={item.unitPricePkr} className="w-24 text-right" />
                {readyAt ? <Badge tone="success" title={formatDateTime(readyAt)}>Ready</Badge> : g.canPrepare ? <Badge tone="pending">To prepare</Badge> : null}
              </li>
            ))}
          </ul>
          {g.canPrepare && pending.length ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-umber-100 pt-3">
              <TextInput name="note" placeholder="Note for Wahbayaan (optional)" aria-label="Note for Wahbayaan" className="max-w-sm" maxLength={300} />
              <SubmitButton>Mark selected ready</SubmitButton>
            </div>
          ) : null}
        </ActionForm>
      </Panel>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Sales" title="Orders" description="Paid orders for your products. Prepare the items and mark them ready — Wahbayaan collects them, delivers to the buyer and handles customer care." />
      {open.length ? <div className="space-y-4">{open.map(card)}</div> : <Empty>No orders to prepare.</Empty>}
      {past.length ? (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Earlier orders</h2>
          {past.map(card)}
        </section>
      ) : null}
    </div>
  );
}
