import Image from "next/image";
import Link from "next/link";
import { BuyerPrice } from "@/components/money/buyer-price";
import { IllustrationTag, isSvg } from "@/components/store/illustration-tag";
import type { PublicBrandProduct } from "@/lib/queries/brands";
import { cn } from "@/lib/utils/cn";

export function BrandProductCard({ product, priority, className }: { product: PublicBrandProduct; priority?: boolean; className?: string }) {
  const href = `/brands/${product.brand.slug}/${product.slug}`;
  const img = product.images[0];
  return (
    <article className={cn("group relative", className)}>
      <Link href={href} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-sand-200">
          {img ? (
            <Image
              src={img.url}
              alt={img.alt ?? product.title}
              fill
              sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
              priority={priority}
              unoptimized={isSvg(img.url) || /^https?:/.test(img.url)}
              className="object-cover transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
            />
          ) : null}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {product.onSale ? <span className="rounded-full bg-terracotta-600 px-2 py-0.5 text-[11px] font-medium text-white">Sale</span> : null}
            {product.isNew ? <span className="rounded-full bg-sand-50/90 px-2 py-0.5 text-[11px] font-medium text-umber-800 backdrop-blur">New</span> : null}
            {!product.inStock ? <span className="rounded-full bg-umber-900/80 px-2 py-0.5 text-[11px] font-medium text-sand-50">Sold out</span> : null}
          </div>
          {img?.kind === "illustration" ? <IllustrationTag className="absolute right-3 bottom-3" /> : null}
        </div>
      </Link>
      <div className="mt-3.5 space-y-1">
        <Link href={`/brands/${product.brand.slug}`} className="truncate text-xs tracking-wide text-umber-500 uppercase hover:text-umber-900">
          {product.brand.name}
        </Link>
        <h3 className="line-clamp-2 font-display text-[1.08rem] leading-snug text-umber-900">
          <Link href={href} className="hover:text-terracotta-700">
            {product.title}
          </Link>
        </h3>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <BuyerPrice pkr={product.priceNowPkr} className="font-semibold text-umber-900" />
          {product.wasPkr ? <BuyerPrice pkr={product.wasPkr} strike className="text-sm" /> : null}
        </div>
        {product.sizes.length ? <p className="truncate text-xs text-umber-500">{product.sizes.join(" · ")}</p> : null}
      </div>
    </article>
  );
}
