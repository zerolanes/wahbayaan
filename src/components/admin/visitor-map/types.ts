/**
 * Data contract served by GET /admin/api/analytics/map (implemented by
 * src/lib/analytics/map-data.ts → getVisitorMapData). The map only reads it.
 */
export type MapRange = "24h" | "7d" | "30d" | "90d" | "all";

export type MapPlace = {
  key: string;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
  visits: number;
  uniqueVisitors: number;
  /** ISO timestamp */
  lastSeen: string;
  online: boolean;
};

export type MapCountry = {
  countryCode: string;
  country: string;
  visits: number;
  uniqueVisitors: number;
  lastSeen: string;
  online: boolean;
};

export type MapLatest = { key: string; lat: number; lng: number; city: string | null; countryCode: string | null; at: string };

export type VisitorMapData = { places: MapPlace[]; countries: MapCountry[]; latest: MapLatest | null };

export type MapMode = "places" | "countries" | "top10";
export type MapStyle = "dark" | "light";
export type ProjectionName = "naturalEarth" | "equirectangular" | "mercator";
export type CrossStyle = "brush" | "fine" | "bold";
export type CrossColour = "auto" | "gold" | "terracotta" | "sand" | "ivory";

/** Per-admin preferences, persisted in localStorage. */
export type VisitorMapSettings = {
  style: MapStyle;
  engine: "auto" | "builtin";
  projection: ProjectionName;
  crossStyle: CrossStyle;
  crossSize: number; // multiplier, 0.75–1.75
  crossColour: CrossColour;
  animationSpeed: number; // multiplier, 0.5–2 (2 = twice as fast)
  flyHoldSeconds: number;
  flyZoom: number; // zoom level, k = 2^(level-1)
  pollSeconds: number;
  maxMarkers: number;
  hideDatacenter: boolean;
  everyPlace: boolean;
  // Card controls (also remembered)
  range: MapRange;
  mode: MapMode;
  liveOnly: boolean;
  labels: boolean;
  autoFly: boolean;
};

/** One thing to draw before clustering, in geographic coordinates. */
export type GeoMarker = {
  id: string;
  lat: number;
  lng: number;
  visits: number;
  uniqueVisitors: number;
  online: boolean;
  lastSeen: string;
  label: string;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  kind: "place" | "country";
  rank?: number;
};

/** A drawn cross after clustering, in screen pixels. */
export type ScreenMarker = {
  id: string;
  x: number;
  y: number;
  members: GeoMarker[];
  visits: number;
  online: boolean;
  latest: boolean;
  size: number;
};

/** Optional timing overrides used by the end-to-end test (window.__VM_TEST__). */
export type VisitorMapTestHooks = {
  pollMs?: number;
  startDelayMs?: number;
  flyMs?: number;
  holdMs?: number;
  homeMs?: number;
  /** Multiplies the zoom-button / cluster flight durations (slow machines). */
  animScale?: number;
  /** Filled in by the map so tests can find crosses: page-pixel positions and zoom. */
  api?: {
    markers(): { id: string; x: number; y: number; count: number; memberIds: string[] }[];
    zoom(): number;
  };
};
