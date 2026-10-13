import Link from "next/link";
import { Tabs } from "@/components/ui/misc";
import { hrefWith, type SearchParams } from "@/lib/admin/params";
import { PERIODS, type StatsRange } from "@/lib/analytics/stats";
import { cn } from "@/lib/utils/cn";

/** Shared pieces for Insights → visitor statistics screens. */

const TABS = [
  { href: "/admin/analytics", label: "Statistics" },
  { href: "/admin/analytics/live", label: "Live now" },
  { href: "/admin/analytics/visits", label: "Visitor journeys" },
  { href: "/admin/analytics/consent", label: "Consent log" },
  { href: "/admin/privacy/banner", label: "Cookie banner" },
  { href: "/admin/analytics/settings", label: "Privacy & tracking" },
] as const;

export function AnalyticsTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return <Tabs items={TABS.map((t) => ({ label: t.label, href: t.href, active: t.href === active }))} />;
}

export function PeriodChips({ path, params, range }: { path: string; params: SearchParams; range: StatsRange }) {
  const chip = (active: boolean) => cn("rounded-lg border px-3 py-1.5 text-sm", active ? "border-umber-900 bg-umber-900 text-white" : "border-umber-200 bg-white text-umber-700 hover:border-umber-400");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <Link key={p.key} href={hrefWith(path, params, { period: p.key, from: null, to: null })} className={chip(range.key === p.key)} aria-current={range.key === p.key ? "true" : undefined}>
            {p.label}
          </Link>
        ))}
      </div>
      <form method="get" action={path} className="flex flex-wrap items-center gap-1.5 text-sm">
        <input type="hidden" name="period" value="custom" />
        <label className="flex h-9 items-center gap-1.5 rounded-lg border border-umber-200 bg-white pr-2 pl-3">
          <span className="text-umber-500">From</span>
          <input type="date" name="from" defaultValue={range.fromStr} className="bg-transparent text-umber-900 focus:outline-none" />
        </label>
        <label className="flex h-9 items-center gap-1.5 rounded-lg border border-umber-200 bg-white pr-2 pl-3">
          <span className="text-umber-500">To</span>
          <input type="date" name="to" defaultValue={range.toStr} className="bg-transparent text-umber-900 focus:outline-none" />
        </label>
        <button className={chip(range.key === "custom")}>Custom dates</button>
      </form>
    </div>
  );
}

export const DECISION_LABEL: Record<string, string> = {
  accept_all: "Accept all",
  essentials: "Essentials only",
  custom: "Custom",
  revoke: "Revoked",
};

export function flag(code: string | null | undefined) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function placeLabel(v: { city: string | null; region?: string | null; country: string | null; countryCode: string | null }) {
  const parts = [v.city, v.country ?? v.countryCode].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown location";
}
