import Image from "next/image";
import type { ReactNode } from "react";
import { ScallopDivider } from "@/components/brand/logo";
import { Breadcrumbs, Container } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";
import { IllustrationTag, isSvg } from "./illustration-tag";

/**
 * Night-indigo page opener used across the storefront's editorial pages: a
 * rounded panel inset to the same margins as the floating header capsule.
 * An optional image sits on the right. (`scallop` adds a hairline rule below;
 * it is off by default — ornament stays plain.)
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
  scallop = false,
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
      <div className="px-2 pt-2 sm:px-4 sm:pt-3">
      <section className="night relative mx-auto max-w-[1400px] overflow-hidden rounded-[var(--radius-sheet)]">
        <Container className={cn(size === "sm" ? "py-10 md:py-16" : size === "lg" ? "py-14 md:py-24" : "py-12 md:py-20")}>
          {crumbs ? <Breadcrumbs items={crumbs} className="mb-7 text-sand-100/80 [&_a:hover]:text-sand-50 [&_span[aria-current]]:text-sand-50 [&_span[aria-hidden]]:text-sand-100/50" /> : null}
          <div className={cn("grid items-center gap-10", hasSide && "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16")}>
            <div className="animate-fade-up">
              {eyebrow ? <p className="text-[0.8125rem] font-semibold tracking-[0.06em] text-gold-300 uppercase">{eyebrow}</p> : null}
              <h1 className={cn("mt-3 font-display leading-[1.03] tracking-[-0.035em] text-balance text-sand-50", size === "sm" ? "text-[2.5rem] md:text-6xl" : "text-[2.75rem] md:text-7xl")}>{title}</h1>
              {description ? <div className="mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-sand-100/90">{description}</div> : null}
              {children ? <div className="mt-8">{children}</div> : null}
            </div>
            {image ? (
              <div className="relative hidden aspect-[4/5] overflow-hidden rounded-[var(--radius-panel)] shadow-lift ring-1 ring-white/10 lg:block">
                <Image src={image} alt="" fill priority sizes="40vw" unoptimized={isSvg(image)} className="object-cover" />
                {imageKind === "illustration" ? <IllustrationTag className="absolute right-4 bottom-4" /> : null}
              </div>
            ) : aside ? (
              <div>{aside}</div>
            ) : null}
          </div>
        </Container>
      </section>
      </div>
      {scallop ? <ScallopDivider className="mt-6" /> : null}
    </>
  );
}

/** Eyebrow + display heading used inside paper sections. */
export function Eyebrow({ children, dark, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return <p className={cn("text-[0.8125rem] font-semibold tracking-[0.06em] uppercase", dark ? "text-gold-300" : "text-gold-700", className)}>{children}</p>;
}
