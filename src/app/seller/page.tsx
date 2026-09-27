import Link from "next/link";
import { ArrowRight, BadgeCheck, CircleAlert, Globe2, Landmark, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { SellerPrice } from "@/components/money/seller-price";
import { SalesChart } from "@/components/seller/sales-chart";
import { VendorOrderBadge } from "@/components/seller/status";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Stat } from "@/components/ui/misc";
import { requireSeller } from "@/lib/auth/session";
import { getSellerStats, getSellerVendor, listSellerOrders } from "@/lib/seller/queries";
import { getSetting } from "@/lib/settings";
import { destinationName } from "@/lib/money/currency";
import { timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Overview" };

export default async function SellerOverview() {
  const user = await requireSeller();
  const [{ vendor, issues, publiclyVisible }, stats, orders, commission] = await Promise.all([
    getSellerVendor(user.vendorId),
    getSellerStats(user.vendorId),
    listSellerOrders(user.vendorId, "action"),
    getSetting("commission"),
  ]);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={vendor.craft}
        title={`Salaam, ${firstName}`}
        description="Your workshop at a glance. Every amount on this dashboard is in Pakistani rupees."
        actions={
          <>
            <ButtonLink href={`/artisans/${vendor.slug}`} variant="outline" size="sm">
              View your shop
            </ButtonLink>
            <ButtonLink href="/seller/listings/new" size="sm">
              Add a listing
            </ButtonLink>
          </>
        }
      />

      {vendor.status !== "verified" ? (
        <Notice tone="pending" title="Verification in progress" icon={<ShieldCheck className="size-4" />}>
          Buyers can&apos;t see your shop until our team finishes verifying your identity, workshop and sample work.{" "}
          <Link href="/seller/verification" className="underline">
            See what&apos;s left
          </Link>
          .
        </Notice>
      ) : !publiclyVisible ? (
        <Notice tone="gold" title="Your shop is hidden from buyers" icon={<CircleAlert className="size-4" />}>
          Fix these to go live: {issues.map((i) => i.message.toLowerCase()).join("; ")}.{" "}
          <Link href="/seller/storefront" className="underline">
            Edit storefront
          </Link>
        </Notice>
      ) : (
        <Notice tone="success" title="Your shop is live" icon={<BadgeCheck className="size-4" />}>
          Verified and visible to buyers in the US, UK and Canada.
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sales, last 30 days" value={<SellerPrice pkr={stats.gross30Pkr} />} hint={`${stats.ordersAll} orders all-time`} />
        <Stat label="Held for you" value={<SellerPrice pkr={stats.heldPkr} />} hint="Paid by buyers, released on delivery" />
        <Stat
          label="Released, awaiting payout"
          value={<SellerPrice pkr={stats.releasedUnpaidPkr} />}
          hint={
            stats.awaitingCommissionPkr > 0
              ? `+ ${Math.round(stats.awaitingCommissionPkr / 100).toLocaleString()} Rs pending commission rate`
              : "Paid to your bank in PKR"
          }
        />
        <Stat
          label="Paid to you"
          value={<SellerPrice pkr={stats.paidOutPkr} />}
          hint={stats.rating.count ? `${stats.rating.average!.toFixed(1)} ★ from ${stats.rating.count} reviews` : "No reviews yet"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Needs your attention"
            description="New orders to accept and parcels ready to hand to the courier."
            action={
              <Link href="/seller/orders" className="text-terracotta-600 text-sm hover:underline">
                All orders
              </Link>
            }
          />
          {orders.length ? (
            <ul className="divide-umber-200/60 divide-y">
              {orders.slice(0, 6).map((o) => (
                <li key={o.vo.id}>
                  <Link href={`/seller/orders/${o.vo.id}`} className="hover:bg-gold-50/50 flex items-center justify-between gap-4 px-5 py-3.5 transition">
                    <div className="min-w-0">
                      <p className="text-umber-900 truncate font-medium">{o.items.map((i) => i.title).join(", ")}</p>
                      <p className="text-umber-500 text-xs">
                        {o.number} · to {destinationName(o.destination)} · {timeAgo(o.createdAt)}
                        {o.isGift ? " · gift" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <SellerPrice pkr={o.vo.subtotalPkr} className="text-sm font-medium" />
                      <VendorOrderBadge status={o.vo.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <EmptyState icon={<PackageCheck className="size-8" />} title="All caught up">
                New paid orders appear here for you to accept. Buyers&apos; payments are already held by Wahbayaan when they arrive.
              </EmptyState>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Sales" description="Paid orders, last 30 days (PKR)" />
          <div className="p-5">
            <SalesChart series={stats.series} />
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                ["To accept", stats.toAccept],
                ["Being made", stats.inProgress],
                ["To ship", stats.toShip],
              ].map(([label, n]) => (
                <div key={label as string} className="bg-sand-100 rounded-xl py-3">
                  <p className="font-display text-umber-900 text-2xl">{n}</p>
                  <p className="text-umber-500 text-xs">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader
            title="Your listings"
            action={
              <Link href="/seller/listings" className="text-terracotta-600 text-sm hover:underline">
                Manage
              </Link>
            }
          />
          <dl className="grid grid-cols-2 gap-3 p-5 text-sm">
            {(
              [
                ["Live", stats.listings.active, "success"],
                ["In review", stats.listings.pending, "pending"],
                ["Drafts", stats.listings.draft, "neutral"],
                ["Needs changes", stats.listings.rejected, "danger"],
              ] as const
            ).map(([label, n, tone]) => (
              <div key={label} className="bg-sand-100 flex items-center justify-between rounded-xl px-3 py-2.5">
                <dt className="text-umber-600">{label}</dt>
                <dd>
                  <Badge tone={tone}>{n}</Badge>
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="How international orders work" description="You make the piece; Wahbayaan handles the buyer, the money and the border." />
          <ol className="grid gap-4 p-5 sm:grid-cols-2">
            {[
              {
                icon: Globe2,
                t: "A buyer abroad pays",
                d: "They pay in dollars, pounds or Canadian dollars — plus shipping and their own import duty. You never deal with currency.",
              },
              {
                icon: Landmark,
                t: "Wahbayaan holds the money",
                d: "The payment stays with us while you make and ship. It's safe from chargebacks and currency swings.",
              },
              {
                icon: Truck,
                t: "You pack, we book the courier",
                d: "Pack using the export guide and enter the tracking number. We prepare the customs invoice.",
              },
              {
                icon: ShieldCheck,
                t: "You're paid in rupees",
                d: `When the buyer confirms delivery (or the protection window ends), your payout is released to your bank in PKR${commission.status === "active" ? `, minus ${commission.defaultBps / 100}% commission` : ""}.`,
              },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex gap-3">
                <span className="bg-gold-100 text-gold-700 grid size-9 shrink-0 place-items-center rounded-full">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-umber-900 font-medium">{t}</p>
                  <p className="text-umber-600 mt-0.5 text-sm">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="px-5 pb-5">
            <Link href="/seller/guide" className="text-terracotta-600 inline-flex items-center gap-1 text-sm font-medium hover:underline">
              Read the full export & payout guide <ArrowRight className="size-4" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
