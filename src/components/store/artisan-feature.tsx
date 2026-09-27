import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import type { PublicVendor } from "@/lib/queries/catalog";
import { cn } from "@/lib/utils/cn";
import { regionLabel, yearsSince } from "@/lib/utils/format";
import { isSvg } from "./illustration-tag";
import { StarRating, VerifiedBadge } from "./trust";

export function responseTimeLabel(hours: number | null | undefined) {
  if (!hours) return "—";
  if (hours <= 1) return "Within an hour";
  if (hours < 24) return `Within ${hours} hours`;
  const days = Math.round(hours / 24);
  return `Within ${days} ${days === 1 ? "day" : "days"}`;
}

/** Trust signals shown wherever an artisan is introduced. */
export function ArtisanStats({ vendor, tone = "light", className }: { vendor: PublicVendor; tone?: "light" | "dark"; className?: string }) {
  const years = yearsSince(vendor.foundedYear);
  const dark = tone === "dark";
  const items = [
    { label: "Years practising", value: years ? `${years}` : "—" },
    { label: "Pieces sold here", value: vendor.salesCount ? vendor.salesCount.toLocaleString("en-US") : "New" },
    { label: "Usually replies", value: responseTimeLabel(vendor.responseTimeHours) },
    { label: "Workshop", value: vendor.locationVerified ? "Location verified" : (vendor.workshopCity ?? "—") },
  ];
  return (
    <dl className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-2xl", dark ? "bg-white/10" : "bg-umber-200/60", className)}>
      {items.map((i) => (
        <div key={i.label} className={cn("px-4 py-3", dark ? "bg-indigo-950/60" : "bg-sand-50")}>
          <dt className={cn("text-[11px] tracking-wider uppercase", dark ? "text-sand-200/60" : "text-umber-500")}>{i.label}</dt>
          <dd className={cn("mt-0.5 font-display text-lg", dark ? "text-sand-50" : "text-umber-900")}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Wide artisan introduction: banner, portrait, story and trust signals. */
export function ArtisanFeatureCard({ vendor, tone = "light", className, cta = "Visit the workshop" }: { vendor: PublicVendor; tone?: "light" | "dark"; className?: string; cta?: string }) {
  const dark = tone === "dark";
  return (
    <article
      className={cn(
        "grid overflow-hidden rounded-[var(--radius-card)] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]",
        dark ? "bg-white/[0.04] ring-1 ring-white/10" : "bg-sand-50 shadow-soft ring-1 ring-umber-200/60",
        className,
      )}
    >
      <div className="relative min-h-60 overflow-hidden">
        {vendor.bannerUrl ? (
          <Image src={vendor.bannerUrl} alt="" fill sizes="(min-width:768px) 40vw, 100vw" unoptimized={isSvg(vendor.bannerUrl)} className="object-cover" />
        ) : (
          <div className="night absolute inset-0" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/70 via-transparent to-transparent" />
        <div className="absolute bottom-5 left-5 flex items-center gap-3">
          <span className="relative size-16 overflow-hidden rounded-full border-2 border-sand-50 bg-sand-200 shadow-lift">
            {vendor.profilePhotoUrl ? (
              <Image src={vendor.profilePhotoUrl} alt={vendor.displayName} fill sizes="64px" unoptimized={isSvg(vendor.profilePhotoUrl)} className="object-cover" />
            ) : null}
          </span>
          {vendor.profilePhotoKind === "illustration" ? <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur">Illustrated portrait</span> : null}
        </div>
      </div>
      <div className="flex flex-col p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <VerifiedBadge size="sm" className={dark ? "rounded-full bg-sand-50 px-2 py-0.5" : undefined} />
          <StarRating average={vendor.rating.average} count={vendor.rating.count} emptyLabel="New artisan — no reviews yet" tone={dark ? "light" : "dark"} />
        </div>
        <h3 className={cn("mt-3 font-display text-3xl", dark ? "text-sand-50" : "text-umber-900")}>{vendor.displayName}</h3>
        <p className={cn("text-sm", dark ? "text-gold-300" : "text-gold-700")}>{vendor.craft}</p>
        <p className={cn("mt-1 flex items-center gap-1 text-sm", dark ? "text-sand-200/70" : "text-umber-500")}>
          <MapPin className="size-3.5" aria-hidden />
          {vendor.workshopCity}
          {vendor.workshopRegion ? `, ${regionLabel(vendor.workshopRegion)}` : ""}
        </p>
        {vendor.story ? <p className={cn("mt-4 line-clamp-4 leading-relaxed", dark ? "text-sand-200/80" : "text-umber-700")}>{vendor.story}</p> : null}
        <ArtisanStats vendor={vendor} tone={tone} className="mt-6" />
        <Link
          href={`/artisans/${vendor.slug}`}
          className={cn("group mt-6 inline-flex items-center gap-2 self-start text-sm font-semibold", dark ? "text-gold-200 hover:text-gold-100" : "text-terracotta-600 hover:text-terracotta-700")}
        >
          {cta}
          <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
