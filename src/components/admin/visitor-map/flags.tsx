import type { ReactNode } from "react";

/**
 * Small, simplified SVG flags (30×20 viewBox) for the countries visitors most
 * often come from. Anything else gets a neutral badge with the ISO code.
 * Never emoji: they render inconsistently (or as letters) across platforms.
 */
const W = 30;
const H = 20;

function star(cx: number, cy: number, r: number, points = 5, inner = 0.45, rot = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = ((rot + (i * 180) / points) * Math.PI) / 180;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

const Star = ({ cx, cy, r, fill = "#fff", points = 5 }: { cx: number; cy: number; r: number; fill?: string; points?: number }) => <polygon points={star(cx, cy, r, points)} fill={fill} />;

const h = (colors: string[], weights?: number[]): ReactNode => {
  const ws = weights ?? colors.map(() => 1);
  const total = ws.reduce((a, b) => a + b, 0);
  let y = 0;
  return colors.map((c, i) => {
    const hh = (ws[i] / total) * H;
    const el = <rect key={i} x={0} y={y} width={W} height={hh + 0.05} fill={c} />;
    y += hh;
    return el;
  });
};

const v = (colors: string[]): ReactNode =>
  colors.map((c, i) => <rect key={i} x={(i * W) / colors.length} y={0} width={W / colors.length + 0.05} height={H} fill={c} />);

const nordic = (bg: string, cross: string, inner?: string): ReactNode => (
  <>
    <rect width={W} height={H} fill={bg} />
    <rect x={8} y={0} width={5} height={H} fill={cross} />
    <rect x={0} y={7.5} width={W} height={5} fill={cross} />
    {inner ? (
      <>
        <rect x={9.25} y={0} width={2.5} height={H} fill={inner} />
        <rect x={0} y={8.75} width={W} height={2.5} fill={inner} />
      </>
    ) : null}
  </>
);

const crescent = (cx: number, cy: number, r: number, bg: string, fill = "#fff", dx = 0.35): ReactNode => (
  <>
    <circle cx={cx} cy={cy} r={r} fill={fill} />
    <circle cx={cx + r * dx} cy={cy - r * 0.12} r={r * 0.82} fill={bg} />
  </>
);

const unionJack = (w = W, hgt = H): ReactNode => (
  <g>
    <rect width={w} height={hgt} fill="#012169" />
    <path d={`M0,0 L${w},${hgt} M${w},0 L0,${hgt}`} stroke="#fff" strokeWidth={hgt * 0.2} />
    <path d={`M0,0 L${w},${hgt} M${w},0 L0,${hgt}`} stroke="#C8102E" strokeWidth={hgt * 0.07} />
    <path d={`M${w / 2},0 V${hgt} M0,${hgt / 2} H${w}`} stroke="#fff" strokeWidth={hgt * 0.33} />
    <path d={`M${w / 2},0 V${hgt} M0,${hgt / 2} H${w}`} stroke="#C8102E" strokeWidth={hgt * 0.2} />
  </g>
);

const FLAGS: Record<string, () => ReactNode> = {
  PK: () => (
    <>
      <rect width={W} height={H} fill="#01411C" />
      <rect width={7.5} height={H} fill="#fff" />
      {crescent(19, 10, 5.2, "#01411C", "#fff", 0.32)}
      <Star cx={21.6} cy={7.6} r={1.7} />
    </>
  ),
  US: () => (
    <>
      {h(["#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234"])}
      <rect width={12} height={10.77} fill="#3C3B6E" />
      {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3, 4].map((c) => <circle key={`${r}${c}`} cx={1.6 + c * 2.2} cy={1.6 + r * 2.5} r={0.5} fill="#fff" />))}
    </>
  ),
  GB: () => unionJack(),
  CA: () => (
    <>
      <rect width={W} height={H} fill="#fff" />
      <rect width={7.5} height={H} fill="#D80621" />
      <rect x={22.5} width={7.5} height={H} fill="#D80621" />
      <path d="M15 4 L16.3 7 L18.6 6.2 L17.8 9.6 L19.8 9.2 L19 11.2 L20.6 12 L16.4 13.6 L16.6 16 L13.4 16 L13.6 13.6 L9.4 12 L11 11.2 L10.2 9.2 L12.2 9.6 L11.4 6.2 L13.7 7 Z" fill="#D80621" />
    </>
  ),
  AE: () => (
    <>
      {h(["#00732F", "#fff", "#000"])}
      <rect width={8} height={H} fill="#FF0000" />
    </>
  ),
  SA: () => (
    <>
      <rect width={W} height={H} fill="#006C35" />
      <path d="M8 8.5 h14 M9 10.5 h12" stroke="#fff" strokeWidth={1} strokeLinecap="round" />
      <path d="M8 14 h13 l1.5 -0.8" stroke="#fff" strokeWidth={0.9} fill="none" strokeLinecap="round" />
    </>
  ),
  IN: () => (
    <>
      {h(["#FF9933", "#fff", "#138808"])}
      <circle cx={15} cy={10} r={2.4} fill="none" stroke="#000080" strokeWidth={0.6} />
      <circle cx={15} cy={10} r={0.5} fill="#000080" />
    </>
  ),
  BD: () => (
    <>
      <rect width={W} height={H} fill="#006A4E" />
      <circle cx={13.5} cy={10} r={5.5} fill="#F42A41" />
    </>
  ),
  AU: () => (
    <>
      <rect width={W} height={H} fill="#012169" />
      <svg x={0} y={0} width={15} height={10} viewBox={`0 0 ${W} ${H}`}>
        {unionJack()}
      </svg>
      <Star cx={7.5} cy={15} r={2.2} points={7} />
      <Star cx={22.5} cy={4.5} r={1.1} points={7} />
      <Star cx={19} cy={9.5} r={1.1} points={7} />
      <Star cx={25.5} cy={8.5} r={1.1} points={7} />
      <Star cx={22.5} cy={16} r={1.1} points={7} />
    </>
  ),
  NZ: () => (
    <>
      <rect width={W} height={H} fill="#012169" />
      <svg x={0} y={0} width={15} height={10} viewBox={`0 0 ${W} ${H}`}>
        {unionJack()}
      </svg>
      {[
        [23, 5],
        [20, 10],
        [26, 9.5],
        [23, 16],
      ].map(([x, y], i) => (
        <g key={i}>
          <Star cx={x} cy={y} r={1.6} />
          <Star cx={x} cy={y} r={1.05} fill="#C8102E" />
        </g>
      ))}
    </>
  ),
  DE: () => h(["#000", "#DD0000", "#FFCE00"]),
  FR: () => v(["#002395", "#fff", "#ED2939"]),
  IT: () => v(["#009246", "#fff", "#CE2B37"]),
  ES: () => h(["#AA151B", "#F1BF00", "#AA151B"], [1, 2, 1]),
  NL: () => h(["#AE1C28", "#fff", "#21468B"]),
  BE: () => v(["#000", "#FDDA24", "#EF3340"]),
  IE: () => v(["#169B62", "#fff", "#FF883E"]),
  SE: () => nordic("#006AA7", "#FECC00"),
  NO: () => nordic("#BA0C2F", "#fff", "#00205B"),
  DK: () => nordic("#C8102E", "#fff"),
  FI: () => nordic("#fff", "#002F6C"),
  CH: () => (
    <>
      <rect width={W} height={H} fill="#DA291C" />
      <rect x={13} y={4} width={4} height={12} fill="#fff" />
      <rect x={9} y={8} width={12} height={4} fill="#fff" />
    </>
  ),
  AT: () => h(["#ED2939", "#fff", "#ED2939"]),
  PL: () => h(["#fff", "#DC143C"]),
  ID: () => h(["#CE1126", "#fff"]),
  RU: () => h(["#fff", "#0039A6", "#D52B1E"]),
  UA: () => h(["#0057B7", "#FFD700"]),
  TR: () => (
    <>
      <rect width={W} height={H} fill="#E30A17" />
      {crescent(11, 10, 5, "#E30A17", "#fff", 0.28)}
      <Star cx={17} cy={10} r={2.2} />
    </>
  ),
  QA: () => (
    <>
      <rect width={W} height={H} fill="#8A1538" />
      <path d={`M0 0 H9 ${Array.from({ length: 9 }, (_, i) => `L12 ${(i + 0.5) * (H / 9)} L9 ${(i + 1) * (H / 9)}`).join(" ")} H0 Z`} fill="#fff" />
    </>
  ),
  KW: () => (
    <>
      {h(["#007A3D", "#fff", "#CE1126"])}
      <path d="M0 0 L8 6.67 V13.33 L0 20 Z" fill="#000" />
    </>
  ),
  OM: () => (
    <>
      {h(["#fff", "#DB161B", "#008000"])}
      <rect width={8} height={H} fill="#DB161B" />
    </>
  ),
  BH: () => (
    <>
      <rect width={W} height={H} fill="#CE1126" />
      <path d={`M0 0 H8 ${Array.from({ length: 5 }, (_, i) => `L12 ${(i + 0.5) * (H / 5)} L8 ${(i + 1) * (H / 5)}`).join(" ")} H0 Z`} fill="#fff" />
    </>
  ),
  JO: () => (
    <>
      {h(["#000", "#fff", "#007A3D"])}
      <path d="M0 0 L14 10 L0 20 Z" fill="#CE1126" />
      <Star cx={4.5} cy={10} r={1.4} points={7} />
    </>
  ),
  EG: () => (
    <>
      {h(["#CE1126", "#fff", "#000"])}
      <circle cx={15} cy={10} r={1.6} fill="#C09300" />
    </>
  ),
  IR: () => (
    <>
      {h(["#239F40", "#fff", "#DA0000"])}
      <circle cx={15} cy={10} r={1.6} fill="none" stroke="#DA0000" strokeWidth={0.6} />
    </>
  ),
  AF: () => v(["#000", "#D32011", "#007A36"]),
  LK: () => (
    <>
      <rect width={W} height={H} fill="#FFB700" />
      <rect x={1.5} y={1.5} width={3} height={17} fill="#005F56" />
      <rect x={4.5} y={1.5} width={3} height={17} fill="#FF5B00" />
      <rect x={9} y={1.5} width={19.5} height={17} fill="#8D153A" />
    </>
  ),
  MY: () => (
    <>
      {h(Array.from({ length: 14 }, (_, i) => (i % 2 ? "#fff" : "#CC0001")))}
      <rect width={15} height={11.43} fill="#010066" />
      {crescent(5.5, 5.7, 3.6, "#010066", "#FFCC00", 0.35)}
      <Star cx={10.5} cy={5.7} r={2.2} fill="#FFCC00" points={14} />
    </>
  ),
  SG: () => (
    <>
      {h(["#EF3340", "#fff"])}
      {crescent(6, 5, 3.4, "#EF3340", "#fff", 0.38)}
      {[
        [9.5, 2.8],
        [11.3, 4.2],
        [10.6, 6.4],
        [8.4, 6.4],
        [7.7, 4.2],
      ].map(([x, y], i) => (
        <Star key={i} cx={x} cy={y} r={0.7} />
      ))}
    </>
  ),
  JP: () => (
    <>
      <rect width={W} height={H} fill="#fff" />
      <circle cx={15} cy={10} r={6} fill="#BC002D" />
    </>
  ),
  KR: () => (
    <>
      <rect width={W} height={H} fill="#fff" />
      <circle cx={15} cy={10} r={5} fill="#0047A0" />
      <path d="M10 10 A5 5 0 0 1 20 10 A2.5 2.5 0 0 1 15 10 A2.5 2.5 0 0 0 10 10 Z" fill="#CD2E3A" />
      <path d="M4 4 l3 -2 M5 5.5 l3 -2 M22 16 l3 -2 M23 17.5 l3 -2 M4 16 l3 2 M22 4 l3 2" stroke="#000" strokeWidth={0.9} />
    </>
  ),
  CN: () => (
    <>
      <rect width={W} height={H} fill="#EE1C25" />
      <Star cx={5} cy={5} r={3} fill="#FFFF00" />
      {[
        [10, 2],
        [12, 4],
        [12, 7],
        [10, 9],
      ].map(([x, y], i) => (
        <Star key={i} cx={x} cy={y} r={1} fill="#FFFF00" />
      ))}
    </>
  ),
  ZA: () => (
    <>
      <rect width={W} height={H} fill="#fff" />
      <rect width={W} height={6.67} fill="#E03C31" />
      <rect y={13.33} width={W} height={6.67} fill="#001489" />
      <path d="M0 0 L12 10 L0 20" stroke="#fff" strokeWidth={7} fill="none" />
      <path d="M-2 0 L12 10 H30 M12 10 L-2 20" stroke="#007749" strokeWidth={4} fill="none" />
      <path d="M0 3 L9 10 L0 17 Z" fill="#000" stroke="#FFB81C" strokeWidth={1.2} />
    </>
  ),
  NG: () => v(["#008751", "#fff", "#008751"]),
  KE: () => h(["#000", "#fff", "#BB0000", "#fff", "#006600"], [6, 1, 6, 1, 6]),
  BR: () => (
    <>
      <rect width={W} height={H} fill="#009C3B" />
      <path d="M15 2.5 L27 10 L15 17.5 L3 10 Z" fill="#FFDF00" />
      <circle cx={15} cy={10} r={4.2} fill="#002776" />
    </>
  ),
  MX: () => (
    <>
      {v(["#006847", "#fff", "#CE1126"])}
      <circle cx={15} cy={10} r={2.2} fill="#8C6A2E" opacity={0.85} />
    </>
  ),
  AR: () => (
    <>
      {h(["#74ACDF", "#fff", "#74ACDF"])}
      <circle cx={15} cy={10} r={1.8} fill="#F6B40E" />
    </>
  ),
  PT: () => (
    <>
      <rect width={W} height={H} fill="#FF0000" />
      <rect width={12} height={H} fill="#006600" />
      <circle cx={12} cy={10} r={3.6} fill="#FFFF00" />
      <circle cx={12} cy={10} r={2.2} fill="#FF0000" />
    </>
  ),
  GR: () => (
    <>
      {h(Array.from({ length: 9 }, (_, i) => (i % 2 ? "#fff" : "#0D5EAF")))}
      <rect width={11.1} height={11.1} fill="#0D5EAF" />
      <rect x={4.45} width={2.2} height={11.1} fill="#fff" />
      <rect y={4.45} width={11.1} height={2.2} fill="#fff" />
    </>
  ),
};

export const FLAG_CODES = Object.keys(FLAGS);

export function Flag({ code, className, title }: { code: string | null | undefined; className?: string; title?: string }) {
  const cc = (code ?? "").toUpperCase();
  const draw = FLAGS[cc];
  const label = title ?? (cc ? `Flag: ${cc}` : "Unknown country");
  if (!draw) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={label} data-flag={cc || "unknown"}>
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={3} fill="#ece2d1" stroke="#a88c62" />
        <text x={W / 2} y={H / 2 + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight={700} fontFamily="Inter Variable, ui-sans-serif, system-ui, sans-serif" fill="#4a3d30">
          {cc || "??"}
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={label} data-flag={cc}>
      <defs>
        <clipPath id={`vm-flag-${cc}`}>
          <rect width={W} height={H} rx={2.5} />
        </clipPath>
      </defs>
      <g clipPath={`url(#vm-flag-${cc})`}>{draw()}</g>
      <rect x={0.25} y={0.25} width={W - 0.5} height={H - 0.5} rx={2.4} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={0.5} />
    </svg>
  );
}
