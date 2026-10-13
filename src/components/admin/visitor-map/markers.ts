import { clusterPoints, crossSize } from "./cluster";
import { CLUSTER_RADIUS } from "./geo";
import type { MapTheme } from "./theme";
import type { CrossStyle, GeoMarker, ScreenMarker } from "./types";

/** Project, cull and cluster geo markers into what gets drawn this frame. */
export function buildScreenMarkers(
  geo: GeoMarker[],
  project: (lng: number, lat: number) => [number, number] | null,
  vp: { width: number; height: number },
  opts: { sizeMultiplier: number; latestId: string | null; radius?: number; margin?: number },
): ScreenMarker[] {
  const margin = opts.margin ?? 60;
  const items: { x: number; y: number; weight: number; item: GeoMarker }[] = [];
  for (const m of geo) {
    const p = project(m.lng, m.lat);
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    if (p[0] < -margin || p[1] < -margin || p[0] > vp.width + margin || p[1] > vp.height + margin) continue;
    items.push({ x: p[0], y: p[1], weight: m.visits + (m.online ? 0.5 : 0), item: m });
  }
  return clusterPoints(items, opts.radius ?? CLUSTER_RADIUS).map((c) => {
    const visits = c.members.reduce((s, m) => s + m.visits, 0);
    const lead = c.members[0];
    return {
      id: c.members.length > 1 ? `cluster:${lead.id}:${c.members.length}` : lead.id,
      x: c.x,
      y: c.y,
      members: c.members,
      visits,
      online: c.members.some((m) => m.online),
      latest: !!opts.latestId && c.members.some((m) => m.id === opts.latestId),
      size: crossSize(visits, opts.sizeMultiplier),
    };
  });
}

export function hitTest(markers: ScreenMarker[], x: number, y: number): ScreenMarker | null {
  let best: ScreenMarker | null = null;
  let bestD = Infinity;
  for (const m of markers) {
    const d = Math.hypot(m.x - x, m.y - y);
    const r = Math.max(13, m.size * 0.75 + (m.members.length > 1 ? 6 : 0));
    if (d <= r && d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

export type DrawOptions = {
  theme: MapTheme;
  colour: string;
  crossStyle: CrossStyle;
  /** ms timestamp (performance.now()). */
  now: number;
  speed: number;
  reducedMotion: boolean;
  hoverId: string | null;
  pinnedId: string | null;
  labels: boolean;
  showRanks: boolean;
  /** first time each marker id was drawn — drives the draw-in animation. */
  appeared: Map<string, number>;
  dpr: number;
};

const DRAW_IN_MS = 520;

function strokeCross(ctx: CanvasRenderingContext2D, s: number, style: CrossStyle, p1: number, p2: number) {
  // s = half-size. Two diagonal strokes, the second starting after the first.
  const seg = (x0: number, y0: number, x1: number, y1: number, p: number, w0: number, w1: number) => {
    if (p <= 0) return;
    const x = x0 + (x1 - x0) * p;
    const y = y0 + (y1 - y0) * p;
    if (style === "brush") {
      // Tapered, slightly curved ink stroke.
      const nx = -(y1 - y0);
      const ny = x1 - x0;
      const len = Math.hypot(nx, ny) || 1;
      const ux = nx / len;
      const uy = ny / len;
      const wEnd = w0 + (w1 - w0) * p;
      const mx = (x0 + x) / 2 + ux * s * 0.08;
      const my = (y0 + y) / 2 + uy * s * 0.08;
      ctx.beginPath();
      ctx.moveTo(x0 + ux * w0 * 0.5, y0 + uy * w0 * 0.5);
      ctx.quadraticCurveTo(mx + ux * (w0 + wEnd) * 0.35, my + uy * (w0 + wEnd) * 0.35, x + ux * wEnd * 0.5, y + uy * wEnd * 0.5);
      ctx.lineTo(x - ux * wEnd * 0.5, y - uy * wEnd * 0.5);
      ctx.quadraticCurveTo(mx - ux * (w0 + wEnd) * 0.35, my - uy * (w0 + wEnd) * 0.35, x0 - ux * w0 * 0.5, y0 - uy * w0 * 0.5);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };
  const w = Math.max(1.6, s * 0.36);
  seg(-s, -s, s, s, p1, w * 1.05, w * 0.55);
  seg(s, -s * 0.92, -s * 0.94, s, p2, w, w * 0.5);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw every cross, ring, count and label. Returns true while something is still animating. */
export function drawMarkers(ctx: CanvasRenderingContext2D, markers: ScreenMarker[], o: DrawOptions): boolean {
  const { theme, colour, now, speed, reducedMotion } = o;
  let animating = false;
  const labelBoxes: [number, number, number, number][] = [];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Busiest last so the important crosses sit on top.
  const order = [...markers].sort((a, b) => a.visits - b.visits);
  for (const m of order) {
    let first = o.appeared.get(m.id);
    if (first === undefined) {
      first = reducedMotion ? now - 10_000 : now;
      o.appeared.set(m.id, first);
    }
    const age = (now - first) * speed;
    const drawIn = reducedMotion ? 1 : Math.min(1, age / DRAW_IN_MS);
    if (drawIn < 1) animating = true;
    const p1 = Math.min(1, drawIn * 1.8);
    const p2 = Math.max(0, Math.min(1, drawIn * 1.8 - 0.8));
    const active = m.id === o.hoverId || m.id === o.pinnedId;
    const breathe = reducedMotion ? 1 : 1 + 0.045 * Math.sin((now * speed) / 420 + m.x * 0.05);
    const half = (m.size / 2) * breathe * (active ? 1.18 : 1);

    // Pulsing "online now" ring.
    if (m.online) {
      ctx.save();
      ctx.strokeStyle = theme.ring;
      if (reducedMotion) {
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(m.x, m.y, half + 6, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        animating = true;
        for (let i = 0; i < 2; i++) {
          const t = ((((now * speed) / 1800 + i * 0.5) % 1) + 1) % 1;
          ctx.globalAlpha = (1 - t) * 0.75;
          ctx.lineWidth = 1.6 * (1 - t) + 0.4;
          ctx.beginPath();
          ctx.arc(m.x, m.y, half * 0.7 + t * (half + 14), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Most recent visit: dashed ring and a small caption.
    if (m.latest) {
      ctx.save();
      ctx.strokeStyle = theme.latest;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([3.5, 3]);
      ctx.lineDashOffset = reducedMotion ? 0 : -((now * speed) / 90) % 13;
      if (!reducedMotion) animating = true;
      ctx.beginPath();
      ctx.arc(m.x, m.y, half + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "600 10px 'Inter Variable', ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineWidth = 3;
      ctx.strokeStyle = theme.labelHalo;
      ctx.strokeText("Last seen", m.x, m.y + half + 13);
      ctx.fillStyle = theme.latest;
      ctx.fillText("Last seen", m.x, m.y + half + 13);
      ctx.restore();
      labelBoxes.push([m.x - 26, m.y + half + 12, 52, 13]);
    }

    if (m.id === o.pinnedId) {
      ctx.save();
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(m.x, m.y, half + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // The cross itself, with a soft glow.
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.fillStyle = colour;
    ctx.strokeStyle = colour;
    ctx.lineWidth = o.crossStyle === "bold" ? Math.max(2.6, half * 0.42) : Math.max(1.4, half * 0.2);
    ctx.shadowColor = theme.crossGlow;
    ctx.shadowBlur = (active ? 16 : 9) * o.dpr;
    strokeCross(ctx, half, o.crossStyle, p1, p2);
    ctx.restore();

    // Count for merged crosses.
    if (m.members.length > 1) {
      const text = String(m.members.length);
      ctx.save();
      ctx.font = "700 10px 'Inter Variable', ui-sans-serif, system-ui, sans-serif";
      const w = Math.max(16, ctx.measureText(text).width + 9);
      const bx = m.x + half * 0.55;
      const by = m.y - half * 0.55 - 14;
      ctx.fillStyle = colour;
      ctx.shadowColor = theme.crossGlow;
      ctx.shadowBlur = 6 * o.dpr;
      roundRect(ctx, bx, by, w, 14, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = theme.clusterText;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, bx + w / 2, by + 7.5);
      ctx.restore();
      labelBoxes.push([bx, by, w, 14]);
    }
  }

  // Labels last, skipping any that would collide.
  if (o.labels || o.showRanks) {
    ctx.save();
    ctx.font = "500 11px 'Inter Variable', ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.lineWidth = 3;
    const byWeight = [...markers].sort((a, b) => b.visits - a.visits);
    for (const m of byWeight) {
      const lead = m.members[0];
      const name = m.members.length > 1 ? `${lead.label} +${m.members.length - 1}` : lead.label;
      const ranks = m.members
        .map((x) => x.rank)
        .filter((r): r is number => !!r)
        .sort((a, b) => a - b);
      const text = o.showRanks && lead.rank ? (o.labels ? `${lead.rank}. ${name}` : ranks.join(" · ")) : name;
      if (!o.labels && !(o.showRanks && lead.rank)) continue;
      const w = ctx.measureText(text).width;
      const x = m.x + m.size / 2 + 7;
      const y = m.y;
      const box: [number, number, number, number] = [x - 2, y - 8, w + 4, 16];
      if (labelBoxes.some((b) => box[0] < b[0] + b[2] && box[0] + box[2] > b[0] && box[1] < b[1] + b[3] && box[1] + box[3] > b[1])) continue;
      labelBoxes.push(box);
      ctx.strokeStyle = theme.labelHalo;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = theme.label;
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  }
  return animating;
}
