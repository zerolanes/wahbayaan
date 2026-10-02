"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ShoppingBag } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";

/** Fired by the purchase form after a successful add, so the bag can open itself. */
export const CART_ADDED_EVENT = "wb:cart-added";

const desktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

/**
 * Header bag. A plain link to /cart (phones, no JS); on tablets and desktops it
 * opens a slide-over mini-cart instead, and opens itself after "Add to cart".
 * The body is rendered on the server and passed in, so prices stay in the
 * buyer's currency and refresh with the page after every cart action.
 */
export function MiniCart({ count, className, children, footer }: { count: number; className?: string; children: ReactNode; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onAdded = () => desktop() && setOpen(true);
    window.addEventListener(CART_ADDED_EVENT, onAdded);
    return () => window.removeEventListener(CART_ADDED_EVENT, onAdded);
  }, []);

  return (
    <>
      <Link
        href="/cart"
        className={className}
        aria-label={`Cart (${count})`}
        onClick={(e) => {
          if (!desktop() || pathname === "/cart" || e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        <ShoppingBag className="size-[18px]" aria-hidden />
        {count > 0 ? <CountBadge n={count} /> : null}
      </Link>
      <Sheet open={open} onClose={() => setOpen(false)} side="right" title="Your bag" description={count ? `${count} ${count === 1 ? "piece" : "pieces"}` : undefined} footer={footer}>
        {children}
      </Sheet>
    </>
  );
}

export function CountBadge({ n, className }: { n: number; className?: string }) {
  return (
    <span
      className={cn(
        "absolute -top-0.5 -right-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-terracotta-600 px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-[var(--color-sand-50)] tabular-nums",
        className,
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
