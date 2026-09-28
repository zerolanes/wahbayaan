import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Brand mark: a plain mehrab — the pointed arch of a haveli doorway — with a
 * small jharokha window. Deliberately simple: no stars, no tilework.
 */
export function StarMark({ className, filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-8", className)} aria-hidden>
      <path
        d="M9 44V22C9 13 16 7 24 3c8 4 15 10 15 19v22z"
        fill={filled ? "#a9502e" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={filled ? 0 : 1.75}
        strokeLinejoin="round"
      />
      <path d="M17 44V27c0-4 3-7.5 7-9.5 4 2 7 5.5 7 9.5v17z" fill={filled ? "#fcfaf5" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Wordmark: “Wahbayaan” in a soft display serif with the Urdu واہ بیان beside it.
 * Replaces the old tall condensed “WAH BAYAAN MARKETPLACE” lettering.
 */
export function Logo({ className, tone = "dark", href = "/", compact = false }: { className?: string; tone?: "dark" | "light" | "current"; href?: string | null; compact?: boolean }) {
  const inner = (
    <span className={cn("group inline-flex items-center gap-2.5", className)}>
      <StarMark className="size-7 transition-transform duration-700 sm:size-8" />
      <span className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-display text-[1.35rem] leading-none font-medium tracking-[-0.02em] sm:text-[1.6rem]",
            tone === "dark" ? "text-ink" : tone === "light" ? "text-sand-50" : "text-current",
          )}
          style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 72' }}
        >
          Wahbayaan
        </span>
        {!compact ? (
          <span lang="ur" className={cn("hidden text-[0.95rem] leading-none sm:inline", tone === "light" ? "text-gold-300" : "text-gold-600")}>
            واہ بیان
          </span>
        ) : null}
      </span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label="Wahbayaan home">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** Plain hairline section rule (formerly a truck-art scallop band). */
export function ScallopDivider({ className }: { className?: string; colors?: string[] }) {
  return <div className={cn("h-px w-full bg-umber-900/10", className)} aria-hidden />;
}

/** Plain hairline section rule (formerly a kashi-tile band). */
export function TileDivider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-umber-900/10", className)} aria-hidden />;
}
