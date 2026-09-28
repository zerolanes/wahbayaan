"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ShoppingBag } from "lucide-react";
import { addCollectionToCart, moveWishlistToCart } from "@/app/actions/cart";

export function MoveToCartButton({ productId, productSlug }: { productId: string; productSlug: string }) {
  const [state, action, pending] = useActionState(moveWishlistToCart, null);
  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="productId" value={productId} />
      <button disabled={pending} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-indigo-900 px-4 text-sm font-medium text-sand-50 transition hover:bg-indigo-800 disabled:opacity-60">
        <ShoppingBag className="size-4" aria-hidden /> {pending ? "Moving…" : "Move to cart"}
      </button>
      {state?.error ? (
        <p className="text-xs text-danger-600" role="alert">
          {state.error}{" "}
          {/options/.test(state.error) ? (
            <Link href={`/product/${productSlug}`} className="underline">
              Open piece
            </Link>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}

export function AddCollectionButton({ slug, label, tone = "light" }: { slug: string; label: string; tone?: "light" | "dark" }) {
  const [state, action, pending] = useActionState(addCollectionToCart, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <button
        disabled={pending}
        className={
          tone === "dark"
            ? "inline-flex h-13 items-center gap-2 rounded-full bg-gradient-to-b from-gold-300 to-gold-500 px-7 text-base font-medium text-ink shadow-glow disabled:opacity-60"
            : "inline-flex h-13 items-center gap-2 rounded-full bg-terracotta-600 px-7 text-base font-medium text-white shadow-soft transition hover:bg-terracotta-700 disabled:opacity-60"
        }
      >
        <ShoppingBag className="size-5" aria-hidden /> {pending ? "Adding…" : label}
      </button>
      <div aria-live="polite">
        {state?.error ? <p className="text-sm text-danger-600">{state.error}</p> : null}
        {state?.ok ? (
          <p className={tone === "dark" ? "text-sm text-gold-100" : "text-sm text-success-700"}>
            {state.message}{" "}
            <Link href="/cart" className="font-semibold underline">
              View cart
            </Link>
          </p>
        ) : null}
      </div>
    </form>
  );
}
