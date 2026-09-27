import { formatMoney } from "@/lib/money/currency";

/** 30-day PKR sales as a soft area chart (pure SVG, no chart library). */
export function SalesChart({ series }: { series: { day: string; pkr: number }[] }) {
  const W = 640;
  const H = 180;
  const pad = { l: 8, r: 8, t: 16, b: 24 };
  const max = Math.max(1, ...series.map((s) => s.pkr));
  const x = (i: number) => pad.l + (i / Math.max(1, series.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(s.pkr).toFixed(1)}`).join(" ");
  const area = `${line} L${x(series.length - 1).toFixed(1)} ${H - pad.b} L${x(0).toFixed(1)} ${H - pad.b} Z`;
  const total = series.reduce((a, s) => a + s.pkr, 0);
  const best = series.reduce((a, s) => (s.pkr > a.pkr ? s : a), series[0] ?? { day: "", pkr: 0 });
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label={`Sales over the last 30 days: ${formatMoney(total, "PKR")}`}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b8893b" stopOpacity="0.35" />
            <stop offset="1" stopColor="#b8893b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={pad.l}
            x2={W - pad.r}
            y1={pad.t + f * (H - pad.t - pad.b)}
            y2={pad.t + f * (H - pad.t - pad.b)}
            stroke="#d2c3b3"
            strokeOpacity="0.5"
            strokeDasharray="3 5"
          />
        ))}
        <path d={area} fill="url(#salesFill)" />
        <path d={line} fill="none" stroke="#9a6f2d" strokeWidth="2" strokeLinejoin="round" />
        {series.map((s, i) => (s.pkr > 0 ? <circle key={s.day} cx={x(i)} cy={y(s.pkr)} r="3" fill="#9a6f2d" /> : null))}
        <text x={pad.l} y={H - 6} fontSize="11" fill="#928069">
          {series[0]?.day.slice(5)}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize="11" fill="#928069" textAnchor="end">
          today
        </text>
      </svg>
      <figcaption className="text-umber-500 mt-1 flex flex-wrap justify-between gap-2 text-xs">
        <span>30-day total {formatMoney(total, "PKR")}</span>
        {best?.pkr ? (
          <span>
            Best day {best.day.slice(5)} · {formatMoney(best.pkr, "PKR")}
          </span>
        ) : (
          <span>No sales yet in this period</span>
        )}
      </figcaption>
    </figure>
  );
}
