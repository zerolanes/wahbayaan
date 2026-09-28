/** Tiny helpers for building SVG strings deterministically. */

export type Rng = () => number;

/** Mulberry32 — small, fast, deterministic PRNG. */
export function rng(seed: number): Rng {
  // Finalise the seed (murmur3 fmix32) so neighbouring seeds diverge immediately.
  let a = seed >>> 0;
  a = Math.imul(a ^ (a >>> 16), 0x85ebca6b);
  a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
  a = (a ^ (a >>> 16)) >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const pick = <T,>(r: Rng, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];
export const range = (r: Rng, min: number, max: number) => min + r() * (max - min);
export const int = (r: Rng, min: number, max: number) => Math.floor(range(r, min, max + 1));

type Attrs = Record<string, string | number | undefined | null | false>;

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function el(tag: string, attrs: Attrs = {}, children: string | string[] = ""): string {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${esc(String(v))}"`)
    .join(" ");
  const body = Array.isArray(children) ? children.join("") : children;
  return body ? `<${tag}${a ? " " + a : ""}>${body}</${tag}>` : `<${tag}${a ? " " + a : ""}/>`;
}

export const f = (n: number) => Number(n.toFixed(2));

export function polygon(points: [number, number][]) {
  return points.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
}

/** Regular star polygon (e.g. the 8-point Mughal star) centred on cx,cy. */
/**
 * A petal rosette (phool) — rounded lobes between `inner` and `outer` radii.
 * Used wherever the artwork needs a central motif; the art deliberately avoids
 * sharp stars and hexagon lattices.
 */
export function starPoints(cx: number, cy: number, outer: number, inner: number, points: number, rotation = 0) {
  const out: [number, number][] = [];
  const steps = points * 12;
  const base = inner + (outer - inner) * 0.15;
  for (let i = 0; i < steps; i++) {
    const a = rotation + (2 * Math.PI * i) / steps;
    const lobe = Math.pow(Math.abs(Math.cos((points * (a - rotation)) / 2)), 0.9);
    const r = base + (outer - base) * lobe;
    out.push([cx + r * Math.sin(a), cy - r * Math.cos(a)]);
  }
  return polygon(out);
}

export function svgDoc(w: number, h: number, body: string, defs = "", title?: string) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">` +
    (title ? `<title>${esc(title)}</title>` : "") +
    (defs ? `<defs>${defs}</defs>` : "") +
    body +
    `</svg>`
  );
}

/** Soft paper/wool grain as a reusable filter. */
export function grainFilter(id: string, opacity = 0.18, frequency = 0.9) {
  return el("filter", { id, x: 0, y: 0, width: "100%", height: "100%" }, [
    el("feTurbulence", { type: "fractalNoise", baseFrequency: frequency, numOctaves: 2, seed: 3, result: "n" }),
    el("feColorMatrix", { in: "n", type: "saturate", values: 0, result: "g" }),
    el("feComponentTransfer", { in: "g", result: "a" }, el("feFuncA", { type: "linear", slope: opacity })),
    el("feComposite", { in: "a", in2: "SourceGraphic", operator: "in", result: "m" }),
    el("feBlend", { in: "SourceGraphic", in2: "m", mode: "multiply" }),
  ]);
}

export function shadowFilter(id: string, dy = 18, blur = 22, opacity = 0.35) {
  return el("filter", { id, x: "-20%", y: "-20%", width: "140%", height: "150%" }, [
    el("feDropShadow", { dx: 0, dy, stdDeviation: blur, "flood-color": "#1a1208", "flood-opacity": opacity }),
  ]);
}

export function linear(id: string, stops: [number, string, number?][], x2 = 0, y2 = 1) {
  return el(
    "linearGradient",
    { id, x1: 0, y1: 0, x2, y2 },
    stops.map(([o, c, op]) => el("stop", { offset: o, "stop-color": c, "stop-opacity": op ?? 1 })),
  );
}

export function radial(id: string, stops: [number, string, number?][], cx = 0.5, cy = 0.5, r = 0.5) {
  return el(
    "radialGradient",
    { id, cx, cy, r },
    stops.map(([o, c, op]) => el("stop", { offset: o, "stop-color": c, "stop-opacity": op ?? 1 })),
  );
}
