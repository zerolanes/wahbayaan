import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { BuyerPrice } from "@/components/money/buyer-price";
import { isSvg } from "@/components/store/illustration-tag";
import { AvailabilityBadge } from "@/components/store/product-card";
import { MoveToCartButton } from "@/components/store/wishlist-actions";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs, Container, EmptyState } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { getWishlistIds } from "@/lib/commerce/cart";
import { getPublicProductsByIds } from "@/lib/queries/storefront";
import { removeFromWishlist } from "@/app/actions/cart";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default async function WishlistPage() {
  const [ctx, user] = await Promise.all([getBuyerContext(), getCurrentUser()]);
  const ids = [...(await getWishlistIds(ctx.ownerKey))];
  const products = await getPublicProductsByIds(ids);
  const unavailable = ids.length - products.length;

  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Wishlist" }]} />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl text-umber-900 md:text-6xl">Your wishlist</h1>
          <p className="mt-2 text-umber-600">
            {products.length} saved {products.length === 1 ? "piece" : "pieces"}
            {!user ? " — saved on this device. Sign in to keep them across devices." : ""}
          </p>
        </div>
        {!user ? (
          <ButtonLink href="/login?next=/wishlist" variant="outline">
            Sign in to sync
          </ButtonLink>
        ) : null}
      </div>

      {products.length ? (
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => {
            const upcoming = p.isLimitedDrop && p.dropStartsAt && p.dropStartsAt > new Date();
            return (
              <li key={p.id} className="flex flex-col">
                <Link href={`/product/${p.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-sand-200">
                  <Image src={p.imageUrl} alt={p.imageAlt ?? p.title} fill sizes="(min-width:1280px) 22vw, (min-width:768px) 30vw, 50vw" unoptimized={isSvg(p.imageUrl)} className="object-cover transition duration-700 group-hover:scale-[1.04]" />
                  {p.imageKind === "illustration" ? <span className="absolute right-3 bottom-3 rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur">Illustration</span> : null}
                </Link>
                <div className="mt-3 flex flex-1 flex-col">
                  <p className="text-xs tracking-wide text-umber-500 uppercase">{p.vendorName}</p>
                  <h2 className="mt-0.5 line-clamp-2 font-display text-lg leading-snug text-umber-900">
                    <Link href={`/product/${p.slug}`} className="hover:text-terracotta-700">
                      {p.title}
                    </Link>
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <BuyerPrice pkr={p.pricePkr} className="font-semibold text-umber-900" />
                    <AvailabilityBadge availability={p.availability} timeToMakeDays={p.timeToMakeDays} />
                  </div>
                  <div className="mt-auto space-y-2 pt-4">
                    {upcoming ? (
                      <Link href={`/product/${p.slug}`} className="inline-flex h-10 w-full items-center justify-center rounded-full bg-indigo-950 text-sm font-medium text-gold-200">
                        Limited drop — join waitlist
                      </Link>
                    ) : p.availability === "ready_to_ship" && p.stockQty <= 0 ? (
                      <p className="rounded-full bg-umber-100 py-2 text-center text-sm text-umber-600">Sold</p>
                    ) : (
                      <MoveToCartButton productId={p.id} productSlug={p.slug} />
                    )}
                    <form action={removeFromWishlist}>
                      <input type="hidden" name="productId" value={p.id} />
                      <button className="w-full text-center text-sm text-umber-500 hover:text-danger-700">Remove</button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState className="mt-10" icon={<Heart className="size-10" aria-hidden />} title="Nothing saved yet" action={<ButtonLink href="/shop">Browse the crafts</ButtonLink>}>
          Tap the heart on any piece to keep it here while you decide — no account needed.
        </EmptyState>
      )}
      {unavailable > 0 ? (
        <p className="mt-8 text-sm text-umber-500">
          {unavailable} saved {unavailable === 1 ? "piece is" : "pieces are"} no longer listed and {unavailable === 1 ? "has" : "have"} been hidden.
        </p>
      ) : null}
    </Container>
  );
}
