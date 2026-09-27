import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/** Eight-point Mughal star — the brand mark. */
export function StarMark({ className, filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="wbGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4dd9a" />
          <stop offset="0.5" stopColor="#c89b45" />
          <stop offset="1" stopColor="#8a6424" />
        </linearGradient>
      </defs>
      <path
        d="M24 2l5.4 11 11.2-2.6L38 21.6 46 24l-8 2.4 2.6 11.2L29.4 35 24 46l-5.4-11-11.2 2.6L10 26.4 2 24l8-2.4L7.4 10.4 18.6 13z"
        fill={filled ? "url(#wbGold)" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={filled ? 0 : 1.5}
      />
      <circle cx="24" cy="24" r="7" fill={filled ? "#171f3d" : "none"} stroke={filled ? "#e0bf73" : "currentColor"} strokeWidth="1.5" />
      <circle cx="24" cy="24" r="2.4" fill={filled ? "#e0bf73" : "currentColor"} />
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
      <StarMark className="size-7 transition-transform duration-700 group-hover:rotate-45 sm:size-8" />
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

/** Truck-art scallop band used as a section divider. */
export function ScallopDivider({ className, colors = ["#b5532e", "#b8893b", "#2a9da8", "#34498a", "#8f1f24"] }: { className?: string; colors?: string[] }) {
  const n = 40;
  return (
    <svg viewBox={`0 0 ${n * 24} 22`} preserveAspectRatio="none" className={cn("block h-4 w-full", className)} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={`M${i * 24} 0 q 12 22 24 0 Z`} fill={colors[i % colors.length]} />
      ))}
      {Array.from({ length: n }, (_, i) => (
        <circle key={`d${i}`} cx={i * 24 + 12} cy={6} r={2} fill="#fcfaf5" />
      ))}
    </svg>
  );
}

/** Kashi-tile band divider. */
export function TileDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-6 w-full opacity-90", className)}
      aria-hidden
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='24'><rect width='48' height='24' fill='%23f7f3ea'/><path d='M24 1l4 7 7 4-7 4-4 7-4-7-7-4 7-4z' fill='%232f5ea8'/><circle cx='24' cy='12' r='2.5' fill='%232a9da8'/><path d='M0 12l6-6 6 6-6 6zM36 12l6-6 6 6-6 6z' fill='%232a9da8' opacity='.8'/></svg>\")",
        backgroundSize: "48px 24px",
      }}
    />
  );
}
