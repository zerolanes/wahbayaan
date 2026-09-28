import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Heart, LifeBuoy, Package, PenTool } from "lucide-react";
import { isSvg } from "@/components/store/illustration-tag";
import { OrderCard } from "@/components/store/order-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { getWishlistIds } from "@/lib/commerce/cart";
import { DISPUTE_STATUS_LABEL } from "@/lib/commerce/order-view";
import { getBuyerDisputes, getBuyerOrders, getBuyerRequests } from "@/lib/queries/account";
import { getPublicProductsByIds } from "@/lib/queries/storefront";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

const ACTIVE = ["awaiting_quote", "quote_sent", "awaiting_payment", "paid", "in_fulfilment", "shipped", "delivered", "disputed"];

export default async function AccountOverview() {
  const user = await requireUser("/account");
  const ctx = await getBuyerContext();
  const [orders, disputes, requests, savedIds] = await Promise.all([getBuyerOrders(user.id, 20), getBuyerDisputes(user.id), getBuyerRequests(user.id), getWishlistIds(ctx.ownerKey)]);
  const saved = await getPublicProductsByIds([...savedIds].slice(0, 4));
  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const openCases = disputes.filter((d) => !["resolved", "closed"].includes(d.status));
  const attention = orders.filter((o) => ["quote_sent", "delivered"].includes(o.status));
  const firstName = user.name.split(/\s+/)[0];

  const stats = [
    { href: "/account/orders", icon: Package, label: "Orders in progress", value: active.length },
    { href: "/account/disputes", icon: LifeBuoy, label: "Open cases", value: openCases.length },
    { href: "/wishlist", icon: Heart, label: "Saved pieces", value: savedIds.size },
    { href: "/account/requests", icon: PenTool, label: "Commissions", value: requests.length },
  ];

  return (
    <div className="space-y-12">
      <header>
        <p className="text-xs font-semibold tracking-[0.2em] text-gold-600 uppercase">Your account</p>
        <h1 className="mt-2 font-display text-4xl text-umber-900 md:text-5xl">Welcome back, {firstName}</h1>
      </header>

      {attention.length ? (
        <div className="night rounded-[var(--radius-card)] p-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">Needs your attention</p>
          <ul className="mt-3 space-y-2">
            {attention.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.number}`} className="group flex items-center justify-between gap-4 rounded-xl bg-white/5 px-4 py-3 text-sand-50 ring-1 ring-white/10 transition hover:bg-white/10">
                  <span>
                    <span className="font-semibold">{o.number}</span> —{" "}
                    {o.status === "quote_sent" ? "your confirmed total is ready to approve" : "delivered: confirm it arrived as described so the artisan is paid"}
                  </span>
                  <ArrowRight className="size-4 text-gold-300 transition group-hover:translate-x-1" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60 transition hover:shadow-soft">
            <s.icon className="size-5 text-gold-600" aria-hidden />
            <p className="mt-3 font-display text-3xl text-umber-900 tabular-nums">{s.value}</p>
            <p className="text-sm text-umber-600 group-hover:text-umber-900">{s.label}</p>
          </Link>
        ))}
      </div>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl text-umber-900">Recent orders</h2>
          {orders.length ? (
            <Link href="/account/orders" className="text-sm font-medium text-terracotta-600 hover:underline">
              All orders
            </Link>
          ) : null}
        </div>
        {orders.length ? (
          <div className="mt-4 space-y-3">
            {orders.slice(0, 3).map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        ) : (
          <EmptyState className="mt-4" title="No orders yet" action={<ButtonLink href="/shop">Browse the crafts</ButtonLink>}>
            When you order, you&apos;ll follow each piece here — from the workshop to your door.
          </EmptyState>
        )}
      </section>

      {openCases.length ? (
        <section>
          <h2 className="font-display text-2xl text-umber-900">Open cases</h2>
          <ul className="mt-4 space-y-3">
            {openCases.map((c) => (
              <li key={c.id}>
                <Link href={`/account/disputes/${c.number}`} className="flex items-center justify-between gap-4 rounded-2xl bg-sand-50 p-4 ring-1 ring-umber-200/60 hover:shadow-soft">
                  <span>
                    <span className="font-semibold text-umber-900">{c.number}</span> <span className="text-sm text-umber-500">· order {c.order.number}</span>
                  </span>
                  <Badge tone="danger">{DISPUTE_STATUS_LABEL[c.status] ?? c.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl text-umber-900">Saved pieces</h2>
            <Link href="/wishlist" className="text-sm font-medium text-terracotta-600 hover:underline">
              Wishlist
            </Link>
          </div>
          {saved.length ? (
            <ul className="mt-4 grid grid-cols-4 gap-3">
              {saved.map((p) => (
                <li key={p.id}>
                  <Link href={`/product/${p.slug}`} className="group block">
                    <span className="relative block aspect-square overflow-hidden rounded-xl bg-sand-200">
                      <Image src={p.imageUrl} alt={p.title} fill sizes="120px" unoptimized={isSvg(p.imageUrl)} className="object-cover transition group-hover:scale-105" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-umber-600">Tap the heart on any piece to save it here.</p>
          )}
        </section>
        <section>
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl text-umber-900">Commissions</h2>
            <Link href="/custom" className="text-sm font-medium text-terracotta-600 hover:underline">
              New request
            </Link>
          </div>
          {requests.length ? (
            <ul className="mt-4 space-y-2">
              {requests.slice(0, 3).map((r) => (
                <li key={r.id}>
                  <Link href="/account/requests" className="flex items-center justify-between gap-3 rounded-xl bg-sand-50 px-4 py-3 text-sm ring-1 ring-umber-200/60 hover:shadow-soft">
                    <span className="truncate text-umber-800">
                      <span className="font-semibold">{r.number}</span> · {r.vendor?.displayName ?? r.category?.name ?? "Any artisan"}
                    </span>
                    <Badge tone={r.status === "quoted" ? "gold" : r.status === "accepted" ? "success" : "neutral"}>{r.status === "quoted" ? "Quote ready" : r.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-umber-600">Ask an artisan to make something just for you — your name in Nastaliq, a rug in your room&apos;s exact size.</p>
          )}
        </section>
      </div>
    </div>
  );
}
