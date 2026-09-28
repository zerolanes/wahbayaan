import Image from "next/image";
import Link from "next/link";
import { BuyerPrice } from "@/components/money/buyer-price";
import type { ProductCardData } from "@/lib/queries/catalog";
import { SHOW_QA_LABELS } from "@/lib/qa";
import { cn } from "@/lib/utils/cn";
import { CompareToggle } from "./compare-toggle";
import { StarRating, VerifiedBadge } from "./trust";
import { WishlistButton } from "./wishlist-button";

export function AvailabilityBadge({ availability, timeToMakeDays, className }: { availability: "ready_to_ship" | "made_to_order"; timeToMakeDays: number | null; className?: string }) {
  return availability === "ready_to_ship" ? (
    <span className={cn("rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700", className)}>Ready to ship</span>
  ) : (
    <span className={cn("rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700", className)}>
      Made to order{timeToMakeDays ? ` · ${timeToMakeDays} days` : ""}
    </span>
  );
}

/** `compared` is optional: when given, the card shows an "Add to compare" toggle. */
export async function ProductCard({ product, saved, priority, className, compared }: { product: ProductCardData; saved: boolean; priority?: boolean; className?: string; compared?: boolean }) {
  const upcoming = product.isLimitedDrop && product.dropStartsAt && product.dropStartsAt > new Date();
  return (
    <article className={cn("group relative", className)}>
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-sand-200">
          <Image
            src={product.imageUrl}
            alt={product.imageAlt ?? product.title}
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
            priority={priority}
            unoptimized={product.imageUrl.endsWith(".svg")}
            className="object-cover transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
          />
          {product.secondImageUrl ? (
            <Image
              src={product.secondImageUrl}
              alt=""
              fill
              sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
              unoptimized={product.secondImageUrl.endsWith(".svg")}
              className="object-cover opacity-0 transition duration-700 group-hover:opacity-100"
            />
          ) : null}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {upcoming ? <span className="rounded-full bg-indigo-950/85 px-2 py-0.5 text-[11px] font-medium text-gold-200 backdrop-blur">Limited drop · soon</span> : null}
            {product.isOneOfAKind ? <span className="rounded-full bg-sand-50/90 px-2 py-0.5 text-[11px] font-medium text-umber-800 backdrop-blur">One of a kind</span> : null}
          </div>
          {SHOW_QA_LABELS && product.imageKind === "illustration" ? (
            <span className="absolute right-3 bottom-3 rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur">Illustration</span>
          ) : null}
        </div>
      </Link>
      <WishlistButton productId={product.id} saved={saved} className="absolute top-3 right-3" />
      <div className="mt-3.5 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/artisans/${product.vendorSlug}`} className="truncate text-xs tracking-wide text-umber-500 uppercase hover:text-umber-900">
            {product.vendorName}
          </Link>
          {product.vendorVerified ? <VerifiedBadge size="xs" label={false} /> : null}
        </div>
        <h3 className="line-clamp-2 font-display text-[1.08rem] leading-snug text-umber-900">
          <Link href={`/product/${product.slug}`} className="hover:text-terracotta-700">
            {product.title}
          </Link>
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <BuyerPrice pkr={product.pricePkr} className="font-semibold text-umber-900" />
          <AvailabilityBadge availability={product.availability} timeToMakeDays={product.timeToMakeDays} />
        </div>
        {compared === undefined ? (
          <StarRating average={product.rating.average} count={product.rating.count} emptyLabel="New — no reviews yet" />
        ) : (
          <div className="flex items-center justify-between gap-2">
            <StarRating average={product.rating.average} count={product.rating.count} emptyLabel="New — no reviews yet" />
            <CompareToggle productId={product.id} compared={compared} />
          </div>
        )}
      </div>
    </article>
  );
}
