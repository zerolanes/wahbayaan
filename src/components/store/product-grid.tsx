import { getBuyerContext } from "@/lib/buyer-context";
import { getWishlistIds } from "@/lib/commerce/cart";
import type { ProductCardData } from "@/lib/queries/catalog";
import { getCompareIds } from "@/lib/queries/storefront";
import { cn } from "@/lib/utils/cn";
import { ProductCard } from "./product-card";

/** Responsive grid of product cards with wishlist and compare state filled in. */
export async function ProductGrid({
  products,
  className,
  priorityCount = 0,
  columns = "default",
}: {
  products: ProductCardData[];
  className?: string;
  priorityCount?: number;
  columns?: "default" | "wide" | "four";
}) {
  const ctx = await getBuyerContext();
  const [saved, compare] = await Promise.all([getWishlistIds(ctx.ownerKey), getCompareIds()]);
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:gap-y-14",
        columns === "default" && "lg:grid-cols-3",
        columns === "wide" && "md:grid-cols-3 xl:grid-cols-4",
        columns === "four" && "md:grid-cols-4",
        className,
      )}
    >
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} saved={saved.has(p.id)} compared={compare.includes(p.id)} priority={i < priorityCount} />
      ))}
    </div>
  );
}
