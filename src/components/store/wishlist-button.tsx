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
          "pressable inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium",
          optimistic ? "bg-terracotta-50 text-terracotta-700 shadow-[inset_0_0_0_1px_var(--color-terracotta-200)]" : "bg-white/70 text-umber-900 shadow-[inset_0_0_0_1px_rgb(34_26_19/0.16)] hover:bg-white",
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
        "glass-thin pressable grid size-10 place-items-center rounded-full text-umber-900",
        optimistic && "text-terracotta-700",
        className,
      )}
    >
      <Heart className={cn("size-4", optimistic && "fill-current")} />
    </button>
  );
}
