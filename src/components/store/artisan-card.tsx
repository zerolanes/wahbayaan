import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { PublicVendor } from "@/lib/queries/catalog";
import { regionLabel, yearsSince } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { StarRating, VerifiedBadge } from "./trust";

/**
 * Artisan story card: the maker's own photo, banner, workshop and a line of
 * their story. Every card is distinct — the old marketplace's identical
 * template banners are rejected upstream by the visibility guards.
 */
export function ArtisanStoryCard({ vendor, className, variant = "default" }: { vendor: PublicVendor; className?: string; variant?: "default" | "feature" }) {
  const years = yearsSince(vendor.foundedYear);
  return (
    <Link
      href={`/artisans/${vendor.slug}`}
      className={cn(
        "group block overflow-hidden rounded-[var(--radius-card)] bg-sand-50 shadow-soft ring-1 ring-umber-200/60 transition duration-500 hover:-translate-y-1 hover:shadow-lift",
        className,
      )}
    >
      <div className={cn("relative overflow-hidden", variant === "feature" ? "h-44" : "h-28")}>
        {vendor.bannerUrl ? (
          <Image src={vendor.bannerUrl} alt="" fill sizes="(min-width:1024px) 33vw, 100vw" unoptimized={vendor.bannerUrl.endsWith(".svg")} className="object-cover transition duration-700 group-hover:scale-105" />
        ) : (
          <div className="night absolute inset-0" />
        )}
      </div>
      <div className="relative px-5 pb-5">
        <div className="-mt-9 flex items-end justify-between">
          <div className="relative size-18 overflow-hidden rounded-full border-4 border-sand-50 bg-sand-200 shadow-soft">
            {vendor.profilePhotoUrl ? (
              <Image src={vendor.profilePhotoUrl} alt={vendor.displayName} fill sizes="72px" unoptimized={vendor.profilePhotoUrl.endsWith(".svg")} className="object-cover" />
            ) : null}
          </div>
          {vendor.status === "verified" ? <VerifiedBadge size="xs" /> : null}
        </div>
        <h3 className="mt-3 font-display text-xl text-umber-900">{vendor.displayName}</h3>
        <p className="text-sm text-gold-700">{vendor.craft}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-umber-500">
          <MapPin className="size-3.5" aria-hidden />
          {vendor.workshopCity}
          {vendor.workshopRegion ? `, ${regionLabel(vendor.workshopRegion)}` : ""}
          {years ? ` · ${years} years` : ""}
        </p>
        {vendor.story ? <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-umber-700">{vendor.story}</p> : null}
        <div className="mt-4 flex items-center justify-between border-t border-umber-200/60 pt-3 text-xs text-umber-500">
          <StarRating average={vendor.rating.average} count={vendor.rating.count} emptyLabel="New artisan — no reviews yet" />
          <span>
            {vendor.productCount} {vendor.productCount === 1 ? "piece" : "pieces"}
          </span>
        </div>
      </div>
    </Link>
  );
}
