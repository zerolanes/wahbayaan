import Image from "next/image";
import type { ReactNode } from "react";
import { ScallopDivider } from "@/components/brand/logo";
import { Breadcrumbs, Container } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";
import { IllustrationTag, isSvg } from "./illustration-tag";

/**
 * Night-indigo page opener used across the storefront's editorial pages.
 * An optional image sits on the right; the truck-art scallop hangs below it.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  image,
  imageKind,
  crumbs,
  children,
  aside,
  size = "md",
  scallop = true,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  image?: string | null;
  imageKind?: "photo" | "illustration" | null;
  crumbs?: { label: string; href?: string }[];
  children?: ReactNode;
  aside?: ReactNode;
  size?: "sm" | "md" | "lg";
  scallop?: boolean;
}) {
  const hasSide = !!image || !!aside;
  return (
    <>
      <section className="night relative overflow-hidden">
        <Container className={cn(size === "sm" ? "py-12 md:py-16" : size === "lg" ? "py-16 md:py-28" : "py-14 md:py-20")}>
          {crumbs ? <Breadcrumbs items={crumbs} className="mb-8 text-sand-200/60 [&_a:hover]:text-sand-50 [&_span[aria-current]]:text-sand-100" /> : null}
          <div className={cn("grid items-center gap-10", hasSide && "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16")}>
            <div className="animate-fade-up">
              {eyebrow ? <p className="text-xs font-semibold tracking-[0.25em] text-gold-300 uppercase">{eyebrow}</p> : null}
              <h1 className={cn("mt-4 font-display leading-[1.02] text-balance text-sand-50", size === "sm" ? "text-4xl md:text-6xl" : "text-5xl md:text-7xl")}>{title}</h1>
              {description ? <div className="mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-sand-200/80">{description}</div> : null}
              {children ? <div className="mt-8">{children}</div> : null}
            </div>
            {image ? (
              <div className="relative hidden aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lift ring-1 ring-white/10 lg:block">
                <Image src={image} alt="" fill priority sizes="40vw" unoptimized={isSvg(image)} className="object-cover" />
                {imageKind === "illustration" ? <IllustrationTag className="absolute right-4 bottom-4" /> : null}
              </div>
            ) : aside ? (
              <div>{aside}</div>
            ) : null}
          </div>
        </Container>
      </section>
      {scallop ? <ScallopDivider className="-mt-px" /> : null}
    </>
  );
}

/** Eyebrow + display heading used inside paper sections. */
export function Eyebrow({ children, dark, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return <p className={cn("text-xs font-semibold tracking-[0.22em] uppercase", dark ? "text-gold-300" : "text-gold-600", className)}>{children}</p>;
}
