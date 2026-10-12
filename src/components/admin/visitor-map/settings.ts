import type { CrossColour, MapRange, VisitorMapSettings } from "./types";

export const DEFAULT_SETTINGS: VisitorMapSettings = {
  style: "dark",
  engine: "auto",
  projection: "naturalEarth",
  crossStyle: "brush",
  crossSize: 1,
  crossColour: "auto",
  animationSpeed: 1,
  flyHoldSeconds: 5,
  flyZoom: 5,
  pollSeconds: 20,
  maxMarkers: 500,
  hideDatacenter: true,
  everyPlace: false,
  range: "7d",
  mode: "places",
  liveOnly: false,
  labels: false,
  autoFly: true,
};

export const RANGES: { value: MapRange; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

const pick = <T,>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/** Accept anything from storage and return a complete, valid settings object. */
export function sanitizeSettings(raw: unknown): VisitorMapSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    style: pick(r.style, ["dark", "light"] as const, d.style),
    engine: pick(r.engine, ["auto", "builtin"] as const, d.engine),
    projection: pick(r.projection, ["naturalEarth", "equirectangular", "mercator"] as const, d.projection),
    crossStyle: pick(r.crossStyle, ["brush", "fine", "bold"] as const, d.crossStyle),
    crossSize: num(r.crossSize, 0.75, 1.75, d.crossSize),
    crossColour: pick<CrossColour>(r.crossColour, ["auto", "gold", "terracotta", "sand", "ivory"], d.crossColour),
    animationSpeed: num(r.animationSpeed, 0.5, 2, d.animationSpeed),
    flyHoldSeconds: num(r.flyHoldSeconds, 1, 30, d.flyHoldSeconds),
    flyZoom: num(r.flyZoom, 2, 9, d.flyZoom),
    pollSeconds: num(r.pollSeconds, 5, 300, d.pollSeconds),
    maxMarkers: num(r.maxMarkers, 25, 5000, d.maxMarkers),
    hideDatacenter: bool(r.hideDatacenter, d.hideDatacenter),
    everyPlace: bool(r.everyPlace, d.everyPlace),
    range: pick(r.range, ["24h", "7d", "30d", "90d", "all"] as const, d.range),
    mode: pick(r.mode, ["places", "countries", "top10"] as const, d.mode),
    liveOnly: bool(r.liveOnly, d.liveOnly),
    labels: bool(r.labels, d.labels),
    autoFly: bool(r.autoFly, d.autoFly),
  };
}

export const storageKey = (userId: string | null | undefined) => `wb:visitor-map:${userId ?? "anon"}`;

export function loadSettings(userId: string | null | undefined): VisitorMapSettings {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return sanitizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(userId: string | null | undefined, s: VisitorMapSettings) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(s));
  } catch {
    /* private mode / storage full — settings just won't persist */
  }
}
