import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type Tone = "neutral" | "indigo" | "terracotta" | "gold" | "success" | "warning" | "danger" | "pending" | "turquoise" | "dark";

const tones: Record<Tone, string> = {
  neutral: "bg-umber-100 text-umber-700",
  indigo: "bg-indigo-100 text-indigo-800",
  terracotta: "bg-terracotta-100 text-terracotta-700",
  gold: "bg-gold-100 text-gold-800",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  pending: "bg-pending-50 text-pending-600 ring-1 ring-inset ring-pending-600/20",
  turquoise: "bg-turquoise-50 text-turquoise-700",
  dark: "bg-indigo-950/80 text-sand-50 backdrop-blur",
};

export function Badge({ tone = "neutral", className, children, ...props }: { tone?: Tone } & ComponentProps<"span">) {
  return (
    <span
      data-tone={tone}
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}
      {...props}
    >
      {children}
    </span>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card" className={cn("rounded-[var(--radius-card)] border border-umber-200/60 bg-sand-50 shadow-soft", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-umber-200/60 px-5 py-4", className)}>
      <div>
        <h3 className="font-sans text-base font-semibold tracking-normal text-umber-900">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-umber-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-umber-300/70 px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-4 text-gold-500">{icon}</div> : null}
      <h3 className="font-display text-xl text-umber-900">{title}</h3>
      {children ? <div className="mt-2 max-w-md text-sm text-umber-600">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Notice({ tone = "gold", title, children, className, icon }: { tone?: "gold" | "indigo" | "danger" | "success" | "pending"; title?: ReactNode; children?: ReactNode; className?: string; icon?: ReactNode }) {
  const map = {
    gold: "border-gold-300 bg-gold-50 text-gold-900",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-900",
    danger: "border-danger-600/30 bg-danger-50 text-danger-700",
    success: "border-success-600/30 bg-success-50 text-success-700",
    pending: "border-pending-600/30 bg-pending-50 text-umber-800",
  } as const;
  return (
    <div className={cn("flex gap-3 rounded-2xl border px-4 py-3 text-sm", map[tone], className)} role="note">
      {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, trend, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; trend?: ReactNode; className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <p className="text-xs font-medium tracking-wider text-umber-500 uppercase">{label}</p>
      <p data-slot="stat-value" className="mt-2 font-display text-3xl text-umber-900 tabular-nums">{value}</p>
      {hint || trend ? (
        <p className="mt-1 flex items-center gap-2 text-sm text-umber-500">
          {trend}
          {hint}
        </p>
      ) : null}
    </Card>
  );
}

export function PageHeader({ eyebrow, title, description, actions, className }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-xs font-semibold tracking-[0.18em] text-gold-600 uppercase">{eyebrow}</p> : null}
        <h1 className="font-display text-3xl text-umber-900 md:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-umber-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Breadcrumbs({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm text-umber-500", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden className="text-umber-300">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="hover:text-umber-900">
                {item.label}
              </Link>
            ) : (
              <span className="text-umber-800" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Tabs({ items, className }: { items: { label: ReactNode; href: string; active?: boolean; count?: number }[]; className?: string }) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-umber-200 scrollbar-none", className)}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm whitespace-nowrap transition",
            t.active ? "border-gold-500 font-semibold text-umber-900" : "border-transparent text-umber-500 hover:text-umber-900",
          )}
        >
          {t.label}
          {t.count != null ? <span className="rounded-full bg-umber-100 px-1.5 text-xs text-umber-600">{t.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}

export function Pagination({ page, pageCount, hrefFor, className }: { page: number; pageCount: number; hrefFor: (p: number) => string; className?: string }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1);
  return (
    <nav className={cn("flex items-center justify-center gap-1 text-sm", className)} aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="rounded-full px-3 py-1.5 hover:bg-umber-900/5">
          ← Prev
        </Link>
      ) : null}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && p - pages[i - 1] > 1 ? <span className="px-1 text-umber-400">…</span> : null}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn("grid size-9 place-items-center rounded-full", p === page ? "bg-indigo-900 text-sand-50" : "hover:bg-umber-900/5")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className="rounded-full px-3 py-1.5 hover:bg-umber-900/5">
          Next →
        </Link>
      ) : null}
    </nav>
  );
}

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10", className)} {...props} />;
}

export function SectionHeading({ eyebrow, title, description, action, align = "left", dark, className }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; align?: "left" | "center"; dark?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-6", align === "center" && "flex-col items-center text-center", className)}>
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow ? <p className={cn("mb-3 text-xs font-semibold tracking-[0.22em] uppercase", dark ? "text-gold-300" : "text-gold-600")}>{eyebrow}</p> : null}
        <h2 className={cn("font-display text-3xl leading-[1.08] md:text-5xl", dark ? "text-sand-50" : "text-umber-900")}>{title}</h2>
        {description ? <p className={cn("mt-4 text-lg", dark ? "text-sand-200/80" : "text-umber-600")}>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
