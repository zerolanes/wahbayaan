import { geoEquirectangular, geoPath, geoMercator, geoNaturalEarth1, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";
import type { ProjectionName } from "./types";

/**
 * Camera maths for the built-in map. Everything here is pure so it can be unit tested.
 *
 * The world is projected once into "base" pixels (the projection fitted to the
 * viewport). The camera is a centre (cx, cy) in base pixels plus a zoom factor k:
 *   screen = (base − centre) · k + viewport / 2
 */
export type Viewport = { width: number; height: number };
export type View = { cx: number; cy: number; k: number };

export const MIN_K = 1;
export const MAX_K = 400;
/** Start view: centre ~22°N 8°E, whole world. */
export const HOME_LNG_LAT: [number, number] = [8, 22];
export const WHEEL_SENSITIVITY = 0.0022;
/** Largest |ln(factor)| one wheel event may apply (≈ ×1.65 / ÷1.65). */
export const MAX_WHEEL_STEP = 0.5;
export const BUTTON_ZOOM = 1.6;
export const DOUBLE_CLICK_ZOOM = 2;
export const CLUSTER_RADIUS = 26;
/** Inertia time constant: ~95% of the glide happens in the first 300 ms. */
export const INERTIA_TAU = 100;
export const INERTIA_DURATION = 300;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const clampK = (k: number, min = MIN_K, max = MAX_K) => clamp(k, min, max);

/** Zoom level ↔ zoom factor (level 1 = whole world). */
export const levelToK = (level: number) => Math.pow(2, level - 1);
export const kToLevel = (k: number) => Math.log2(k) + 1;

/** Normalised wheel delta (pixels) → multiplicative zoom factor e^(−Δy·0.0022), capped per event. */
export function wheelFactor(deltaY: number, deltaMode = 0, pageHeight = 800): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * pageHeight : deltaY;
  return Math.exp(clamp(-px * WHEEL_SENSITIVITY, -MAX_WHEEL_STEP, MAX_WHEEL_STEP));
}

export function baseToScreen(view: View, vp: Viewport, bx: number, by: number): [number, number] {
  return [(bx - view.cx) * view.k + vp.width / 2, (by - view.cy) * view.k + vp.height / 2];
}

export function screenToBase(view: View, vp: Viewport, sx: number, sy: number): [number, number] {
  return [(sx - vp.width / 2) / view.k + view.cx, (sy - vp.height / 2) / view.k + view.cy];
}

/** Multiply the zoom by `factor`, keeping the base point under screen (sx, sy) fixed. */
export function zoomAround(view: View, factor: number, sx: number, sy: number, vp: Viewport, min = MIN_K, max = MAX_K): View {
  const k = clampK(view.k * factor, min, max);
  const [bx, by] = screenToBase(view, vp, sx, sy);
  return { k, cx: bx - (sx - vp.width / 2) / k, cy: by - (sy - vp.height / 2) / k };
}

/** Pan by a screen-pixel delta (drag right → map moves right → centre moves left). */
export function panBy(view: View, dx: number, dy: number): View {
  return { k: view.k, cx: view.cx - dx / view.k, cy: view.cy - dy / view.k };
}

/** Keep the centre over the projected world so it can't be dragged away into empty space. */
export function clampView(view: View, bounds: [[number, number], [number, number]], min = MIN_K, max = MAX_K): View {
  const [[x0, y0], [x1, y1]] = bounds;
  return { k: clampK(view.k, min, max), cx: clamp(view.cx, x0, x1), cy: clamp(view.cy, y0, y1) };
}

/** Distance travelled after t ms by a glide that started at velocity v (px/ms) and decays exponentially. */
export function inertiaOffset(v: number, t: number, tau = INERTIA_TAU): number {
  return v * tau * (1 - Math.exp(-t / tau));
}
export function inertiaVelocity(v: number, t: number, tau = INERTIA_TAU): number {
  return v * Math.exp(-t / tau);
}

/** Fastest fling we honour, px/ms. */
export const MAX_FLING = 3;

/** Velocity (px/ms) from the last ~80 ms of pointer samples, capped at MAX_FLING. */
export function estimateVelocity(samples: { x: number; y: number; t: number }[], windowMs = 80): [number, number] {
  if (samples.length < 2) return [0, 0];
  const last = samples[samples.length - 1];
  let first = samples[samples.length - 2];
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i].t > windowMs) break;
    first = samples[i];
  }
  // Events delivered in one burst can share (almost) the same timestamp: treat that as one frame.
  const dt = Math.max(16, last.t - first.t);
  const vx = (last.x - first.x) / dt;
  const vy = (last.y - first.y) / dt;
  const speed = Math.hypot(vx, vy);
  return speed > MAX_FLING ? [(vx / speed) * MAX_FLING, (vy / speed) * MAX_FLING] : [vx, vy];
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Smooth zoom-and-pan path (van Wijk & Nuij), as d3.interpolateZoom. Views are
 * [centreX, centreY, width-in-base-units]; returns t ∈ [0,1] → view.
 */
export function interpolateZoom(p0: [number, number, number], p1: [number, number, number], rho = Math.SQRT2) {
  const rho2 = rho * rho;
  const rho4 = rho2 * rho2;
  const [ux0, uy0, w0] = p0;
  const [ux1, uy1, w1] = p1;
  const dx = ux1 - ux0;
  const dy = uy1 - uy0;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-12) {
    const S = Math.log(w1 / w0) / rho;
    return (t: number): [number, number, number] => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S)];
  }
  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  return (t: number): [number, number, number] => {
    const s = t * S;
    const coshr0 = Math.cosh(r0);
    const u = (w0 / (rho2 * d1)) * (coshr0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
    return [ux0 + u * dx, uy0 + u * dy, (w0 * coshr0) / Math.cosh(rho * s + r0)];
  };
}

/* ---------------------------------------------------------------- projections */

/** Mercator has no finite sphere outline: fit it to the corners of an 82°S–84°N band. */
const MERCATOR_OUTLINE: GeoPermissibleObjects = {
  type: "MultiPoint",
  coordinates: [
    [-179.999, 84],
    [179.999, 84],
    [179.999, -82],
    [-179.999, -82],
  ],
};

export function projectionOutline(name: ProjectionName): GeoPermissibleObjects {
  return name === "mercator" ? MERCATOR_OUTLINE : { type: "Sphere" };
}

export function createProjection(name: ProjectionName): GeoProjection {
  if (name === "mercator") return geoMercator();
  if (name === "equirectangular") return geoEquirectangular();
  return geoNaturalEarth1();
}

export type BaseProjection = {
  name: ProjectionName;
  /** Projection fitted to the viewport — the "base" frame (k = 1). */
  base: GeoProjection;
  scale: number;
  translate: [number, number];
  bounds: [[number, number], [number, number]];
  /** A second instance that the camera re-scales every frame. */
  live: GeoProjection;
};

export function fitBaseProjection(name: ProjectionName, vp: Viewport, pad = 8): BaseProjection {
  const base = createProjection(name).precision(0.5);
  const outline = projectionOutline(name);
  base.fitExtent(
    [
      [pad, pad],
      [Math.max(pad + 1, vp.width - pad), Math.max(pad + 1, vp.height - pad)],
    ],
    outline,
  );
  const scale = base.scale();
  const translate = base.translate() as [number, number];
  const bounds = geoPath(base).bounds(outline) as [[number, number], [number, number]];
  const live = createProjection(name).precision(0.4);
  return { name, base, scale, translate, bounds, live };
}

/** Configure `bp.live` so that it maps lng/lat straight to screen pixels for `view`. */
export function applyView(bp: BaseProjection, view: View, vp: Viewport): GeoProjection {
  const [tx, ty] = bp.translate;
  return bp.live
    .scale(bp.scale * view.k)
    .translate([(tx - view.cx) * view.k + vp.width / 2, (ty - view.cy) * view.k + vp.height / 2])
    .clipExtent([
      [-2, -2],
      [vp.width + 2, vp.height + 2],
    ]);
}

export function lngLatToScreen(bp: BaseProjection, view: View, vp: Viewport, lng: number, lat: number): [number, number] | null {
  const p = bp.base([lng, lat]);
  if (!p) return null;
  return baseToScreen(view, vp, p[0], p[1]);
}

export function screenToLngLat(bp: BaseProjection, view: View, vp: Viewport, sx: number, sy: number): [number, number] | null {
  const [bx, by] = screenToBase(view, vp, sx, sy);
  return bp.base.invert?.([bx, by]) ?? null;
}

export function homeView(bp: BaseProjection): View {
  const p = bp.base(HOME_LNG_LAT) ?? bp.translate;
  return { cx: p[0], cy: p[1], k: 1 };
}
