import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import s from "./pc.module.css";

export type Tone = "magenta" | "teal" | "saffron";

/** Thin repeating phool-patti strip (decorative). */
export function PhoolStrip({ className, thin }: { className?: string; thin?: boolean }) {
  return <div aria-hidden className={cn(s.phool, thin && s.phoolThin, className)} />;
}

/** Section divider: hairline + a short phool strip in the middle. */
export function PhoolDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn(s.divider, "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10", className)}>
      <span className={cn(s.phool, s.phoolThin, "w-24 shrink-0 sm:w-32")} />
    </div>
  );
}

/** Hand-painted floral spray that appears in a card's corner on hover / focus. */
export function FloralCorner() {
  return (
    <svg viewBox="0 0 80 80" className={s.corner} aria-hidden>
      <path d="M78 2C62 8 48 18 40 34" fill="none" stroke="#00796f" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M62 10c-6-6-14-6-18-2 6 2 12 4 18 2z" fill="#00796f" stroke="#221a13" strokeWidth=".6" />
      <path d="M50 22c2-8-2-14-8-16 0 6 2 12 8 16z" fill="#00796f" stroke="#221a13" strokeWidth=".6" />
      <path d="M46 28c-8-2-14 2-16 6 6 0 12-2 16-6z" fill="#00796f" stroke="#221a13" strokeWidth=".6" />
      <g transform="translate(66 14)" stroke="#221a13" strokeWidth=".7">
        {[0, 60, 120, 180, 240, 300].map((r) => (
          <ellipse key={r} cx="0" cy="-6.5" rx="3.6" ry="6" fill="#b5175e" transform={`rotate(${r})`} />
        ))}
        <circle r="3.6" fill="#f2a007" />
        <circle r="1.3" fill="#221a13" stroke="none" />
      </g>
      <g stroke="#221a13" strokeWidth=".5">
        <circle cx="38" cy="36" r="3.2" fill="#f2a007" />
        <circle cx="38" cy="36" r="1.1" fill="#b5175e" stroke="none" />
      </g>
      <circle cx="56" cy="6" r="1.6" fill="#b5175e" />
      <circle cx="74" cy="30" r="1.6" fill="#f2a007" />
    </svg>
  );
}

const CHIP: Record<Tone, string> = {
  magenta: "bg-[var(--pc-magenta-tint)] text-[var(--pc-magenta-ink)]",
  teal: "bg-[var(--pc-teal-tint)] text-[var(--pc-teal-ink)]",
  saffron: "bg-[var(--pc-saffron-tint)] text-[var(--pc-saffron-ink)]",
};

/** Small truck-art colour-pop tag. Text colours pass AA on their tints. */
export function Chip({ tone = "magenta", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] leading-none font-semibold tracking-[0.02em]", CHIP[tone], className)}>{children}</span>;
}

/** Plain coloured label text (no pill); the inks pass AA on the page background. */
const EYEBROW: Record<Tone, string> = {
  magenta: "text-[var(--pc-magenta-ink)]",
  teal: "text-[var(--pc-teal-ink)]",
  saffron: "text-[var(--pc-saffron-ink)]",
};

export const TONES: Tone[] = ["magenta", "teal", "saffron"];

/** Section head: small plain label, display title, Urdu accent line, one short line and an optional action. */
export function SectionHead({
  id,
  eyebrow,
  title,
  urdu,
  line,
  tone = "magenta",
  action,
  align = "left",
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  urdu?: string;
  line?: string;
  tone?: Tone;
  action?: { label: string; href: string };
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("flex gap-x-6 gap-y-4", align === "center" ? "flex-col items-center text-center" : "flex-wrap items-end justify-between", className)}>
      <div className={cn("flex max-w-2xl flex-col", align === "center" ? "items-center" : "items-start")}>
        {eyebrow ? <p className={cn("text-sm font-medium", EYEBROW[tone])}>{eyebrow}</p> : null}
        <h2 id={id} className={cn(s.display, eyebrow ? "mt-1.5" : "", "text-[2rem] text-[var(--pc-ink)] sm:text-[2.5rem] lg:text-[2.75rem]")}>
          {title}
        </h2>
        {urdu ? (
          <p lang="ur" dir="rtl" className={cn(s.urdu, "mt-1 text-lg text-[var(--pc-muted)]")} style={{ textAlign: align === "center" ? "center" : "left" }}>
            {urdu}
          </p>
        ) : null}
        {line ? <p className={cn("text-[0.95rem] text-[var(--pc-muted)]", urdu ? "mt-0" : "mt-2")}>{line}</p> : null}
      </div>
      {action ? <PillLink href={action.href}>{action.label}</PillLink> : null}
    </div>
  );
}

/** Quiet pill link with an arrow (the theme's round "Visit the blog" button). */
export function PillLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "pressable group inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-medium text-[var(--pc-ink)] shadow-[0_0_0_1px_var(--pc-line),0_1px_2px_rgb(34_26_19/0.05)] hover:shadow-[0_0_0_1px_rgb(34_26_19/0.18),0_6px_18px_-8px_rgb(34_26_19/0.3)]",
        className,
      )}
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** Clearly marked slot where a real photograph must go before launch. */
export function PhotoNeeded({ children, className, dark }: { children: React.ReactNode; className?: string; dark?: boolean }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute z-[3] max-w-[calc(100%-1.5rem)] rounded-md px-2 py-1 font-mono text-[10.5px] leading-tight",
        dark ? "bg-black/70 text-white" : "bg-white/90 text-[var(--pc-ink)] shadow-[0_0_0_1px_var(--pc-line)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export const isSvg = (url: string | null | undefined) => !!url && url.split("?")[0].endsWith(".svg");
