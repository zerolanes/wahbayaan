import Link from "next/link";
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Badge, Card, CardHeader, type Tone } from "@/components/ui/misc";
import { Input } from "@/components/ui/form";
import { humanize, toneFor } from "@/lib/admin/labels";
import { orderMoney } from "@/lib/admin/money";
import { cn } from "@/lib/utils/cn";

/** Shared admin building blocks (server components). */

export function StatusBadge({ kind, status, label, className }: { kind: string; status: string | null | undefined; label?: ReactNode; className?: string }) {
  return (
    <Badge tone={toneFor(kind, status)} className={className}>
      {label ?? humanize(status)}
    </Badge>
  );
}

export function DemoBadge({ show = true }: { show?: boolean | null }) {
  if (!show) return null;
  return (
    <Badge tone="neutral" className="px-1.5 py-0 text-[10px] tracking-wide uppercase" title="Seeded demo data">
      Demo
    </Badge>
  );
}

export function PendingBadge({ children = "Pending" }: { children?: ReactNode }) {
  return <Badge tone="pending">{children}</Badge>;
}

/** Buyer-order amount with its currency code, e.g. "$1,250 USD". */
export function OrderAmount({ amount, currency, className }: { amount: number | null | undefined; currency: string; className?: string }) {
  if (amount == null) return <span className={cn("text-umber-400", className)}>—</span>;
  return <span className={cn("tabular-nums", className)}>{orderMoney(amount, currency)}</span>;
}

export function DetailGrid({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">{main}</div>
      <aside className="min-w-0 space-y-6">{side}</aside>
    </div>
  );
}

export function Panel({ title, description, action, children, className, bodyClassName }: { title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader title={title} description={description} action={action} />
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function KV({ items, className }: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-umber-200/60 text-sm", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0">
          <dt className="shrink-0 text-umber-500">{k}</dt>
          <dd className="min-w-0 text-right text-umber-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** GET filter form: search box + any filter controls; state lives in the URL. */
export function FilterBar({ action, q, placeholder = "Search…", children, extra }: { action: string; q?: string; placeholder?: string; children?: ReactNode; extra?: ReactNode }) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-2">
      {q !== undefined ? (
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-umber-400" />
          <Input name="q" defaultValue={q} placeholder={placeholder} className="h-9 rounded-full pl-9 text-sm" data-admin-search aria-label="Search" />
        </div>
      ) : null}
      {children}
      <button className="h-9 rounded-full bg-indigo-900 px-4 text-sm font-medium text-sand-50 hover:bg-indigo-800">Apply</button>
      <Link href={action} className="h-9 rounded-full px-3 text-sm leading-9 text-umber-500 hover:text-umber-900">
        Reset
      </Link>
      {extra ? <div className="ml-auto flex items-center gap-2">{extra}</div> : null}
    </form>
  );
}

export function FilterSelect({ name, value, options, label }: { name: string; value: string; options: { value: string; label: string }[]; label: string }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-medium tracking-wide text-umber-500 uppercase">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="h-9 rounded-full border border-umber-200 bg-white/90 px-3 pr-7 text-sm font-normal tracking-normal text-umber-900 normal-case focus:border-gold-500 focus:outline-none"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterDate({ name, value, label }: { name: string; value: string; label: string }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-medium tracking-wide text-umber-500 uppercase">
      {label}
      <input type="date" name={name} defaultValue={value} className="h-9 rounded-full border border-umber-200 bg-white/90 px-3 text-sm font-normal text-umber-900 focus:border-gold-500 focus:outline-none" />
    </label>
  );
}

export function ExportLink({ href, children = "Export CSV" }: { href: string; children?: ReactNode }) {
  return (
    <a href={href} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-umber-300/70 px-3.5 text-sm text-umber-800 hover:border-umber-900 hover:bg-white/60">
      ↓ {children}
    </a>
  );
}

/** A table inside a card, with an optional toolbar row. */
export function TableCard({ toolbar, children, footer, className }: { toolbar?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {toolbar ? <div className="flex flex-wrap items-center justify-between gap-3 border-b border-umber-200/60 bg-sand-100/40 px-4 py-2.5">{toolbar}</div> : null}
      {children}
      {footer ? <div className="border-t border-umber-200/60 px-4 py-3">{footer}</div> : null}
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-6 py-12 text-center text-sm text-umber-500">{children}</div>;
}

export function MiniStat({ label, value, hint, tone, href }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: Tone; href?: string }) {
  const inner = (
    <>
      <p className="text-[11px] font-medium tracking-wider text-umber-500 uppercase">{label}</p>
      <p className={cn("mt-1.5 font-display text-2xl tabular-nums", tone === "danger" ? "text-danger-700" : tone === "pending" ? "text-pending-600" : "text-umber-900")}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-umber-500">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-[var(--radius-card)] border border-umber-200/60 bg-sand-50 p-4 shadow-soft transition hover:border-gold-400">
      {inner}
    </Link>
  ) : (
    <div className="rounded-[var(--radius-card)] border border-umber-200/60 bg-sand-50 p-4 shadow-soft">{inner}</div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-sans text-sm font-semibold tracking-wider text-umber-500 uppercase">{children}</h2>
      {action}
    </div>
  );
}

export function Thumb({ src, alt, kind, size = 40, className }: { src: string | null | undefined; alt: string; kind?: string | null; size?: number; className?: string }) {
  if (!src) return <div className={cn("shrink-0 rounded-lg bg-umber-100", className)} style={{ width: size, height: size }} aria-label="No image" />;
  return (
    <span className={cn("relative inline-block shrink-0 overflow-hidden rounded-lg bg-umber-100", className)} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      {kind === "illustration" ? <span className="absolute right-0 bottom-0 left-0 bg-indigo-950/70 text-center text-[8px] leading-3 text-sand-50">illus.</span> : null}
    </span>
  );
}
