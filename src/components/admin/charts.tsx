"use client";

import { useState } from "react";
import { niceMax } from "@/lib/admin/series";
import { cn } from "@/lib/utils/cn";

export type BarDatum = { key: string; label: string; value: number; display: string };

/**
 * Vertical bar chart (single series) with a hover tooltip. Values are formatted
 * on the server and passed as `display` strings.
 */
export function BarChart({
  data,
  color = "#171717",
  height = 180,
  title,
  axisDivisor = 1,
  labelEvery,
}: {
  data: BarDatum[];
  color?: string;
  height?: number;
  title: string;
  /** Axis values are divided by this before display (100 for minor units). */
  axisDivisor?: number;
  labelEvery?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const w = 100 / Math.max(1, data.length);
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 7));
  const active = hover == null ? null : data[hover];
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n / axisDivisor);
  return (
    <figure className="relative" aria-label={title}>
      <div className="flex gap-2">
        <div className="flex w-10 shrink-0 flex-col justify-between text-right text-[11px] text-umber-400 tabular-nums" style={{ height }}>
          <span>{fmt(max)}</span>
          <span>{fmt(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative flex-1" style={{ height }} onMouseLeave={() => setHover(null)}>
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn("border-t", i === 2 ? "border-[#e5e5e5]" : "border-[#f0f0f0]")} />
            ))}
          </div>
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={title}>
            {data.map((d, i) => {
              const h = max ? (d.value / max) * 100 : 0;
              return (
                <g key={d.key}>
                  <rect x={i * w} y={0} width={w} height={100} fill="transparent" onMouseEnter={() => setHover(i)} />
                  {d.value > 0 ? (
                    <rect
                      x={i * w + w * 0.14}
                      y={100 - h}
                      width={w * 0.72}
                      height={h}
                      rx={Math.min(1.2, w * 0.2)}
                      fill={color}
                      opacity={hover == null || hover === i ? 1 : 0.35}
                      style={{ pointerEvents: "none" }}
                    />
                  ) : null}
                </g>
              );
            })}
          </svg>
          {active ? (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md bg-[#0a0a0a] px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lift"
              style={{ left: `${(hover! + 0.5) * w}%` }}
            >
              <span className="text-white/60">{active.label}</span> · <strong className="tabular-nums">{active.display}</strong>
            </div>
          ) : null}
        </div>
      </div>
      <div className="relative mt-1.5 ml-12 h-4 text-[11px] text-umber-400">
        {data.map((d, i) =>
          i % every === 0 ? (
            <span key={d.key} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(i + 0.5) * w}%` }}>
              {d.label}
            </span>
          ) : null,
        )}
      </div>
      <figcaption className="sr-only">
        {title}: {data.map((d) => `${d.label} ${d.display}`).join(", ")}
      </figcaption>
    </figure>
  );
}

/** Tiny trend line for stat tiles (no axes). */
export function Sparkline({ values, color = "#0a0a0a", width = 120, height = 32, label }: { values: number[]; color?: string; width?: number; height?: number; label: string }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="overflow-visible">
      <polyline points={`0,${height} ${pts.join(" ")} ${width},${height}`} fill={color} opacity={0.1} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Ranked horizontal bars with direct labels. */
export function HBarList({ items, color = "#404040", empty = "No data yet" }: { items: { key: string; label: React.ReactNode; value: number; display: string; href?: string }[]; color?: string; empty?: string }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-umber-500">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-umber-800">{i.href ? <a href={i.href} className="hover:text-[#0a0a0a] hover:underline">{i.label}</a> : i.label}</span>
            <span className="shrink-0 font-medium text-umber-900 tabular-nums">{i.display}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#f0f0f0]">
            <div className="h-full rounded-full transition-all group-hover:opacity-80" style={{ width: `${Math.max(2, (i.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Horizontal stacked share bar (e.g. orders by currency) with a legend. */
export function ShareBar({ parts }: { parts: { key: string; label: string; value: number; display: string; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return <p className="text-sm text-umber-500">No data yet</p>;
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.key} title={`${p.label}: ${p.display}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2 text-umber-700">
            <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
            {p.label} <span className="font-medium text-umber-900 tabular-nums">{p.display}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Radial score meter for the launch-readiness page. */
export function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Readiness score ${score} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f0f0" strokeWidth={10} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-[#0a0a0a] font-sans font-semibold tabular-nums" fontSize={size / 4}>
        {score}
      </text>
    </svg>
  );
}
