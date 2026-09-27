import { BadgeCheck, Lock, PackageCheck, ShieldCheck, Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Verified Artisan badge — identity, workshop and samples checked by Wahbayaan. */
export function VerifiedBadge({ size = "sm", className, label = true }: { size?: "xs" | "sm" | "md"; className?: string; label?: boolean }) {
  const s = size === "xs" ? "size-3.5" : size === "sm" ? "size-4" : "size-5";
  return (
    <span
      className={cn("inline-flex items-center gap-1 font-medium text-turquoise-700", size === "md" ? "text-sm" : "text-xs", className)}
      title="Verified artisan: identity, workshop and sample work checked by Wahbayaan"
    >
      <BadgeCheck className={cn(s, "fill-turquoise-500 text-white")} aria-hidden />
      {label ? <span>Verified artisan</span> : <span className="sr-only">Verified artisan</span>}
    </span>
  );
}

/**
 * Star rating. With no reviews it says so plainly instead of showing an
 * empty 0-star bar (which read as fake on the old marketplace).
 */
export function StarRating({
  average,
  count,
  size = "sm",
  showCount = true,
  emptyLabel = "No reviews yet",
  className,
  tone = "dark",
}: {
  average: number | null;
  count: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  emptyLabel?: string;
  className?: string;
  tone?: "dark" | "light";
}) {
  if (!count || average == null) {
    return <span className={cn("text-xs", tone === "dark" ? "text-umber-500" : "text-sand-200/70", className)}>{emptyLabel}</span>;
  }
  const s = size === "sm" ? "size-3.5" : size === "md" ? "size-4" : "size-5";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} aria-label={`Rated ${average.toFixed(1)} out of 5 from ${count} reviews`}>
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, average - (i - 1)));
          return (
            <span key={i} className="relative">
              <Star className={cn(s, tone === "dark" ? "text-umber-200" : "text-white/25")} fill="currentColor" strokeWidth={0} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={cn(s, "text-gold-500")} fill="currentColor" strokeWidth={0} />
              </span>
            </span>
          );
        })}
      </span>
      <span className={cn("text-xs tabular-nums", tone === "dark" ? "text-umber-600" : "text-sand-200/80")}>
        {average.toFixed(1)}
        {showCount ? <span className="opacity-70"> ({count})</span> : null}
      </span>
    </span>
  );
}

export function TrustBadges({ className, tone = "light", compact }: { className?: string; tone?: "light" | "dark"; compact?: boolean }) {
  const items = [
    { icon: Lock, title: "Secure payment", text: "Pay by card in your own currency." },
    { icon: ShieldCheck, title: "Buyer protection", text: "Funds are held until your piece arrives as described." },
    { icon: BadgeCheck, title: "Verified artisans", text: "Identity, workshop and sample work checked." },
    { icon: PackageCheck, title: "Landed cost up front", text: "Shipping and duty itemised before you pay." },
  ];
  return (
    <ul className={cn("grid gap-4", compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title} className={cn("flex gap-3 rounded-2xl p-4", tone === "light" ? "bg-sand-50 ring-1 ring-umber-200/60" : "bg-white/5 ring-1 ring-white/10")}>
          <Icon className={cn("mt-0.5 size-5 shrink-0", tone === "light" ? "text-gold-600" : "text-gold-300")} aria-hidden />
          <div>
            <p className={cn("text-sm font-semibold", tone === "light" ? "text-umber-900" : "text-sand-50")}>{title}</p>
            {!compact ? <p className={cn("mt-0.5 text-sm", tone === "light" ? "text-umber-600" : "text-sand-200/70")}>{text}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
