import Image from "next/image";
import Link from "next/link";
import { isSvg } from "@/components/store/illustration-tag";
import { monogram } from "@/lib/brands/permission";
import { cn } from "@/lib/utils/cn";

/** A brand's logo (authorised partners only reach the storefront), or a monogram until the logo is supplied. */
export function BrandLogo({ name, logoUrl, size = 64, className }: { name: string; logoUrl: string | null; size?: number; className?: string }) {
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-sand-100 ring-1 ring-umber-200/70", className)} style={{ width: size, height: size }}>
      {logoUrl ? (
        <Image src={logoUrl} alt={`${name} logo`} fill sizes={`${size}px`} unoptimized={isSvg(logoUrl)} className="object-contain p-1.5" />
      ) : (
        <span className="font-display text-umber-800" style={{ fontSize: size * 0.34 }} aria-hidden>
          {monogram(name)}
        </span>
      )}
    </span>
  );
}

export function BrandTile({ brand }: { brand: { slug: string; name: string; logoUrl: string | null; description: string | null; productCount: number; audiences: string[] } }) {
  return (
    <Link href={`/brands/${brand.slug}`} className="group flex items-center gap-4 rounded-[var(--radius-card)] bg-sand-50 p-4 ring-1 ring-umber-200/60 transition hover:ring-umber-400">
      <BrandLogo name={brand.name} logoUrl={brand.logoUrl} />
      <span className="min-w-0">
        <span className="block font-display text-xl text-umber-900 group-hover:text-terracotta-700">{brand.name}</span>
        <span className="block text-sm text-umber-500">
          {brand.audiences.length ? `${brand.audiences.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(" · ")} · ` : ""}
          {brand.productCount} {brand.productCount === 1 ? "piece" : "pieces"}
        </span>
      </span>
    </Link>
  );
}
