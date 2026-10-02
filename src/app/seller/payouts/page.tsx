import Link from "next/link";
import { Wallet } from "lucide-react";
import { SellerPrice } from "@/components/money/seller-price";
import { FUNDS_LABEL } from "@/components/seller/status";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Stat } from "@/components/ui/misc";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { requireSeller } from "@/lib/auth/session";
import { getSellerStats, getSellerVendor, listSellerPayouts } from "@/lib/seller/queries";
import { getSetting } from "@/lib/settings";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Payouts" };

const PAYOUT_TONE = { pending: "pending", scheduled: "indigo", paid: "success", on_hold: "warning", failed: "danger" } as const;

export default async function SellerPayouts() {
  const user = await requireSeller();
  const [{ payouts, ledger }, stats, { vendor }, commission, escrow] = await Promise.all([
    listSellerPayouts(user.vendorId),
    getSellerStats(user.vendorId),
    getSellerVendor(user.vendorId),
    getSetting("commission"),
    getSetting("escrow"),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Payouts"
        description="Everything you earn is paid to your bank in Pakistani rupees. Buyers' payments are held by Wahbayaan until their piece arrives."
      />
      {commission.status !== "active" ? (
        <Notice tone="pending" title="Commission rate not set yet">
          Wahbayaan&apos;s commission hasn&apos;t been finalised, so released orders show “awaiting commission” until it is. You&apos;ll see the exact figure
          before any payout.
        </Notice>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Held for you" value={<SellerPrice pkr={stats.heldPkr} />} hint="Released after delivery" />
        <Stat label="Awaiting payout" value={<SellerPrice pkr={stats.releasedUnpaidPkr} />} />
        <Stat label="Awaiting commission rate" value={<SellerPrice pkr={stats.awaitingCommissionPkr} />} />
        <Stat label="Paid to you" value={<SellerPrice pkr={stats.paidOutPkr} />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Order earnings" description="Each order's rupee earnings and where the money is." />
          {ledger.length ? (
            <Table>
              <THead>
                <tr>
                  <Th>Order</Th>
                  <Th>Buyer&apos;s payment</Th>
                  <Th className="text-right">Your pieces</Th>
                  <Th className="text-right">Commission</Th>
                  <Th className="text-right">You receive</Th>
                </tr>
              </THead>
              <TBody>
                {ledger.map((l) => (
                  <Tr key={l.vo.id}>
                    <Td>
                      <Link href={`/seller/orders/${l.vo.id}`} className="hover:text-terracotta-700 font-medium">
                        {l.number}
                      </Link>
                      <p className="text-umber-500 text-xs">{formatDate(l.paidAt)}</p>
                    </Td>
                    <Td className="text-xs">{FUNDS_LABEL[l.fundsState] ?? l.fundsState}</Td>
                    <Td className="text-right">
                      <SellerPrice pkr={l.vo.subtotalPkr} />
                    </Td>
                    <Td className="text-right">
                      {l.vo.commissionPkr != null ? <SellerPrice pkr={l.vo.commissionPkr} /> : <Badge tone="pending">pending</Badge>}
                    </Td>
                    <Td className="text-right font-medium">{l.vo.netPkr != null ? <SellerPrice pkr={l.vo.netPkr} /> : "—"}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <div className="p-5">
              <EmptyState icon={<Wallet className="size-8" />} title="No earnings yet">
                Your first paid order will appear here.
              </EmptyState>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Payout history" />
            {payouts.length ? (
              <ul className="divide-umber-200/60 divide-y">
                {payouts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>
                      <SellerPrice pkr={p.amountPkr} className="font-medium" />
                      <span className="text-umber-500 block text-xs">
                        {p.paidAt ? `Paid ${formatDate(p.paidAt)}` : `Created ${formatDate(p.createdAt)}`}
                        {p.reference ? ` · ref ${p.reference}` : ""}
                      </span>
                    </span>
                    <Badge tone={PAYOUT_TONE[p.status]}>{p.status.replace("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-umber-500 p-5 text-sm">No payouts yet.</p>
            )}
          </Card>
          <Card>
            <CardHeader
              title="Paid to"
              action={
                <Link href="/seller/settings" className="text-terracotta-600 text-sm hover:underline">
                  Edit
                </Link>
              }
            />
            <div className="text-umber-700 space-y-1 p-5 text-sm">
              <p>{vendor.payoutBankName ?? "No bank added yet"}</p>
              <p>{vendor.payoutAccountTitle}</p>
              {vendor.payoutAccountLast4 ? <p className="text-umber-500">Account ending {vendor.payoutAccountLast4}</p> : null}
            </div>
          </Card>
          <Card className="text-umber-600 p-5 text-sm">
            <p className="text-umber-900 font-medium">When am I paid?</p>
            <p className="mt-1">
              When the buyer confirms their piece arrived as described — or {escrow.autoReleaseDaysAfterDelivery} days after delivery if they don&apos;t respond
              — the money is released and added to your next payout.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
