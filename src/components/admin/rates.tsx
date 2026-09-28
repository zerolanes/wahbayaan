import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Tabs, type Tone } from "@/components/ui/misc";
import type { CellState } from "@/lib/admin/rate-coverage";
import { percentOf } from "@/lib/admin/rate-coverage";
import { formatMoney, isBuyerCurrency, type Currency } from "@/lib/money/currency";
import { cn } from "@/lib/utils/cn";
import { formatDate, timeAgo } from "@/lib/utils/format";

/** Shared pieces for the Cross-border → rate pages. */

const RATE_TABS = [
  { href: "/admin/rates/fx", label: "Exchange rates" },
  { href: "/admin/rates/shipping", label: "Shipping" },
  { href: "/admin/rates/duty", label: "Duty & import tax" },
  { href: "/admin/rates/rules", label: "Import rules" },
  { href: "/admin/rates/fees", label: "Fees & commission" },
] as const;

export function RatesTabs({ active }: { active: (typeof RATE_TABS)[number]["href"] }) {
  return <Tabs items={RATE_TABS.map((t) => ({ label: t.label, href: t.href, active: t.href === active }))} />;
}

const CONFIG_TONE: Record<string, Tone> = { pending: "pending", active: "success", disabled: "neutral" };
const CONFIG_LABEL: Record<string, string> = { pending: "Pending", active: "Active", disabled: "Disabled" };

export function ConfigBadge({ status }: { status: string }) {
  return <Badge tone={CONFIG_TONE[status] ?? "neutral"}>{CONFIG_LABEL[status] ?? status}</Badge>;
}

/** A configured amount, or a clear "Pending" — never a zero standing in for missing data. */
export function RateAmount({ amount, currency, className }: { amount: number | null | undefined; currency: string; className?: string }) {
  if (amount == null) return <Badge tone="pending">Pending</Badge>;
  const text = isBuyerCurrency(currency) ? formatMoney(amount, currency as Currency, { cents: amount % 100 !== 0 }) : `${(amount / 100).toFixed(2)} ${currency}`;
  return (
    <span className={cn("tabular-nums", className)}>
      {text} <span className="text-xs text-umber-500">{currency}</span>
    </span>
  );
}

export function Percent({ value, className }: { value: string | number | null | undefined; className?: string }) {
  if (value == null || value === "") return <Badge tone="pending">Pending</Badge>;
  return <span className={cn("tabular-nums", className)}>{+Number(value).toFixed(3)}%</span>;
}

/** "Last updated / source" cell. */
export function SourceCell({ source, updatedAt }: { source: string | null | undefined; updatedAt: Date | string | null | undefined }) {
  return (
    <div className="max-w-60 text-xs">
      <p className={cn("truncate", source ? "text-umber-700" : "text-umber-400")} title={source ?? undefined}>
        {source ?? "No source recorded"}
      </p>
      {updatedAt ? (
        <p className="text-umber-500" title={formatDate(updatedAt)}>
          Updated {timeAgo(updatedAt)}
        </p>
      ) : null}
    </div>
  );
}

const CELL: Record<CellState, { cls: string; label: string }> = {
  active: { cls: "bg-success-50 text-success-700 ring-success-600/20", label: "Active" },
  pending: { cls: "bg-warning-50 text-warning-700 ring-warning-600/25", label: "Pending" },
  disabled: { cls: "bg-umber-100 text-umber-500 ring-umber-300/50", label: "Disabled" },
  missing: { cls: "bg-white text-umber-400 ring-umber-200 border-dashed", label: "No row" },
};

/** Grid of rows × columns showing which combinations can be quoted. */
export function CoverageMatrix({
  title,
  rows,
  columns,
  cell,
  footer,
}: {
  title: ReactNode;
  rows: { key: string; label: ReactNode }[];
  columns: { key: string; label: ReactNode }[];
  cell: (row: string, col: string) => { state: CellState; detail?: ReactNode; href?: string };
  footer?: ReactNode;
}) {
  return (
    <div data-slot="card" className="overflow-hidden rounded-[var(--radius-card)] border border-umber-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-umber-200 px-4 py-3">
        <p className="text-sm font-medium text-umber-900">{title}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-umber-500">
          {(["active", "pending", "disabled", "missing"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={cn("inline-block size-2.5 rounded-sm ring-1", CELL[s].cls)} />
              {CELL[s].label}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-umber-500">
              <th className="px-4 py-2 font-medium" />
              {columns.map((c) => (
                <th key={c.key} className="px-1.5 py-2 text-center font-medium whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="px-4 py-1 text-left font-medium whitespace-nowrap text-umber-700">
                  {r.label}
                </th>
                {columns.map((c) => {
                  const x = cell(r.key, c.key);
                  const inner = (
                    <span className={cn("flex h-7 min-w-16 items-center justify-center rounded-md px-2 ring-1 whitespace-nowrap", CELL[x.state].cls)}>{x.detail ?? CELL[x.state].label}</span>
                  );
                  return (
                    <td key={c.key} className="px-1.5 py-1">
                      {x.href ? (
                        <Link href={x.href} className="block hover:opacity-80">
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer ? <div className="border-t border-umber-200/60 px-4 py-2.5 text-xs text-umber-500">{footer}</div> : null}
    </div>
  );
}

/** Thin progress bar with a "n of m" label. */
export function CoverageBar({ n, total, label }: { n: number; total: number; label: string }) {
  const pct = percentOf(n, total);
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-umber-500">
        <span>{label}</span>
        <span className="tabular-nums">
          {n} / {total} · {pct}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-umber-100">
        <div className={cn("h-full rounded-full", pct === 100 ? "bg-success-600" : "bg-umber-900")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
