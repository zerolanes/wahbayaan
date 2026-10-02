import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Glass material primitives (storefront chrome). Materials map to the `.glass*`
 * classes in globals.css, which carry the tint, blur, edge highlight, a solid
 * fallback (no backdrop-filter / reduced transparency) and a high-contrast mode.
 *
 * Use glass for things that float over content — header, tab bar, sheets,
 * menus, popovers, toasts, chips over imagery. Content cards stay solid.
 * Never put glass on glass.
 */
export type Material = "ultrathin" | "thin" | "regular" | "thick" | "dark";

export const materialClass: Record<Material, string> = {
  ultrathin: "glass-ultrathin",
  thin: "glass-thin",
  regular: "glass",
  thick: "glass-thick",
  dark: "glass-dark",
};

type GlassTag = "div" | "section" | "aside" | "nav" | "header" | "footer" | "ul" | "span";

/** A translucent material surface. Defaults to a rounded `regular` panel. */
export function Glass({ as: Tag = "div", material = "regular", className, ...props }: { as?: GlassTag; material?: Material } & ComponentProps<"div">) {
  const El = Tag as "div";
  return <El data-material={material} className={cn(materialClass[material], "rounded-[var(--radius-panel)]", className)} {...props} />;
}

/**
 * Segmented control built from links (works without JavaScript). The active
 * segment is a raised white thumb inside a recessed track.
 */
export function SegmentedControl({
  items,
  label,
  className,
  size = "md",
}: {
  items: { label: ReactNode; href: string; active?: boolean; count?: number }[];
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <nav aria-label={label} className={cn("max-w-full overflow-x-auto scrollbar-none", className)}>
      <ul className="inline-flex gap-0.5 rounded-full bg-umber-900/[0.06] p-1">
        {items.map((i) => (
          <li key={i.href} className="shrink-0">
            <Link
              href={i.href}
              aria-current={i.active ? "page" : undefined}
              className={cn(
                "pressable inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
                size === "sm" ? "h-8 px-3 text-[0.8125rem]" : "h-9 px-4 text-sm",
                i.active ? "bg-white text-umber-900 shadow-[0_1px_2px_rgb(34_26_19/0.1),0_2px_8px_-2px_rgb(34_26_19/0.12)]" : "text-umber-700 hover:text-umber-900",
              )}
            >
              {i.label}
              {i.count != null ? <span className={cn("rounded-full px-1.5 text-xs tabular-nums", i.active ? "bg-umber-100 text-umber-700" : "bg-umber-900/[0.06] text-umber-700")}>{i.count}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Small rounded pill/chip. `glass` floats over imagery; `solid` sits on the page. */
export function Pill({ tone = "solid", className, ...props }: { tone?: "solid" | "glass" | "dark" | "accent" } & ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] leading-none font-semibold",
        tone === "solid" && "bg-white text-umber-800 shadow-[0_0_0_0.5px_rgb(34_26_19/0.12)]",
        tone === "glass" && "glass-thin text-umber-900",
        tone === "dark" && "glass-dark text-sand-50",
        tone === "accent" && "bg-terracotta-600 text-white",
        className,
      )}
      {...props}
    />
  );
}

/** Round icon button; `glass` for over-image controls, `plain` for toolbars. */
export function iconButtonClass(variant: "glass" | "plain" | "solid" = "plain", size: "sm" | "md" | "lg" = "md") {
  return cn(
    "pressable relative grid shrink-0 place-items-center rounded-full",
    size === "sm" ? "size-9" : size === "md" ? "size-10" : "size-11",
    variant === "glass" && "glass-thin text-umber-900",
    variant === "plain" && "text-current hover:bg-current/[0.08]",
    variant === "solid" && "bg-white text-umber-900 shadow-soft hover:bg-sand-50",
  );
}
