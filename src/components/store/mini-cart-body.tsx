import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import type { CartView } from "@/lib/commerce/cart";
import type { BuyerCurrency } from "@/lib/money/currency";
import { formatMoney } from "@/lib/money/currency";
import { isSvg } from "./illustration-tag";

/** Server-rendered contents of the header mini-cart (see MiniCart). */
export function MiniCartBody({ cart, currency, priced }: { cart: CartView; currency: BuyerCurrency; priced: boolean }) {
  if (!cart.lines.length)
    return (
      <div className="flex flex-col items-center px-4 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-umber-900/[0.06] text-umber-700">
          <ShoppingBag className="size-7" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-semibold text-umber-900">Your cart is empty</p>
        <p className="mt-1 max-w-xs text-sm text-umber-700">Add a piece and you&apos;ll see its full landed cost — shipping, duty and tax — before checkout.</p>
        <Link href="/shop" className={buttonClass("primary", "md", "mt-6")}>
          Browse the crafts
        </Link>
      </div>
    );
  const cur = cart.landed?.currency ?? currency;
  return (
    <ul className="divide-y divide-umber-900/[0.07]">
      {cart.lines.map((l) => (
        <li key={l.id} className="flex gap-3.5 py-3.5 first:pt-1">
          <Link href={`/product/${l.slug}`} tabIndex={-1} aria-hidden className="relative size-20 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-sand-200">
            {l.imageUrl ? <Image src={l.imageUrl} alt="" fill sizes="80px" unoptimized={isSvg(l.imageUrl)} className="object-cover" /> : null}
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/product/${l.slug}`} className="line-clamp-2 text-sm leading-snug font-semibold text-umber-900 hover:text-terracotta-700">
              {l.title}
            </Link>
            <p className="mt-0.5 truncate text-xs text-umber-700">{l.vendorName}</p>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-sm">
              <span className="text-umber-700">Qty {l.qty}</span>
              <span className="font-semibold text-umber-900 tabular-nums">{priced ? formatMoney(l.lineTotal, cur, { cents: true }) : "Price on request"}</span>
            </div>
            {l.unavailableReason ? <p className="mt-1 text-xs font-medium text-danger-700">{l.unavailableReason}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MiniCartFooter({ cart, currency, priced }: { cart: CartView; currency: BuyerCurrency; priced: boolean }) {
  if (!cart.lines.length) return null;
  const cur = cart.landed?.currency ?? currency;
  const subtotal = cart.lines.reduce((n, l) => n + l.lineTotal, 0);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-umber-800">Items subtotal</span>
        <span className="text-base font-semibold text-umber-900 tabular-nums">{priced ? formatMoney(subtotal, cur, { cents: true }) : "Price on request"}</span>
      </div>
      <p className="text-xs text-umber-700">Shipping, import duty and tax for your country are itemised in your cart before you pay.</p>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/cart" className={buttonClass("outline", "md", "w-full")}>
          View cart
        </Link>
        <Link href="/checkout" className={buttonClass("accent", "md", "w-full")}>
          Checkout <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
