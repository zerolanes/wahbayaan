"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleWishlist } from "@/app/actions/storefront";
import { cn } from "@/lib/utils/cn";

export function WishlistButton({ productId, saved, className, variant = "icon" }: { productId: string; saved: boolean; className?: string; variant?: "icon" | "full" }) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [, start] = useTransition();
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      setOptimistic(!optimistic);
      await toggleWishlist(productId);
    });
  };
  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={optimistic}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-medium transition",
          optimistic ? "border-terracotta-300 bg-terracotta-50 text-terracotta-700" : "border-umber-300/70 hover:border-umber-900",
          className,
        )}
      >
        <Heart className={cn("size-4", optimistic && "fill-current")} />
        {optimistic ? "Saved to wishlist" : "Save to wishlist"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={optimistic}
      aria-label={optimistic ? "Remove from wishlist" : "Save to wishlist"}
      className={cn(
        "grid size-9 place-items-center rounded-full bg-sand-50/90 text-umber-800 shadow-soft backdrop-blur transition hover:scale-110",
        optimistic && "text-terracotta-600",
        className,
      )}
    >
      <Heart className={cn("size-4", optimistic && "fill-current")} />
    </button>
  );
}
