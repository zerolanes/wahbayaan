import type { CrossColour, MapStyle } from "./types";

/**
 * Map palettes. Hex values are the storefront brand palette (globals.css @theme),
 * written out literally because `.admin-theme` remaps the Tailwind colour tokens
 * to greys — the map keeps Wahbayaan's own colours.
 */
export type MapTheme = {
  /** Outside the globe outline. */
  space: string;
  sea: string;
  seaGlow: string;
  land: string;
  /** Choropleth ramp from "a few visits" to "most visits". */
  ramp: string[];
  border: string;
  coast: string;
  admin1: string;
  graticule: string;
  cross: string;
  crossGlow: string;
  ring: string;
  latest: string;
  label: string;
  labelHalo: string;
  clusterText: string;
};

export const THEMES: Record<MapStyle, MapTheme> = {
  dark: {
    space: "#090c1a",
    sea: "#0d1124", // indigo-950
    seaGlow: "#171f3d", // indigo-900
    land: "#1b2447",
    ramp: ["#2e3046", "#3e3a44", "#4d4443", "#605042", "#7a5a3e", "#8a4a3c"], // land mixed towards gold, then terracotta
    border: "rgba(224, 191, 115, 0.30)", // gold-300
    coast: "rgba(236, 215, 164, 0.70)", // gold-200
    admin1: "rgba(224, 191, 115, 0.16)",
    graticule: "rgba(158, 173, 216, 0.06)", // indigo-300
    cross: "#e0bf73", // gold-300
    crossGlow: "rgba(224, 191, 115, 0.55)",
    ring: "#ecd7a4",
    latest: "#f5ead0",
    label: "#f6f0e6",
    labelHalo: "rgba(13, 17, 36, 0.85)",
    clusterText: "#0d1124",
  },
  light: {
    space: "#ece4d6",
    sea: "#f6f1e8", // parchment
    seaGlow: "#fdfbf7",
    land: "#ece2d1", // sand-200
    ramp: ["#e8d9bd", "#e5d0a8", "#e2c892", "#dfbe7e", "#dca06c", "#d5845b"],
    border: "rgba(118, 100, 79, 0.45)", // umber-500
    coast: "rgba(74, 61, 48, 0.75)", // umber-700
    admin1: "rgba(118, 100, 79, 0.22)",
    graticule: "rgba(118, 100, 79, 0.07)",
    cross: "#a9502e", // terracotta-600
    crossGlow: "rgba(196, 98, 58, 0.35)",
    ring: "#c4623a",
    latest: "#4a3d30",
    label: "#221a13",
    labelHalo: "rgba(246, 241, 232, 0.9)",
    clusterText: "#fdfbf7",
  },
};

const CROSS_COLOURS: Record<Exclude<CrossColour, "auto">, { dark: string; light: string }> = {
  gold: { dark: "#e0bf73", light: "#9a6f2d" },
  terracotta: { dark: "#e4a07f", light: "#a9502e" },
  sand: { dark: "#ece2d1", light: "#76644f" },
  ivory: { dark: "#fdfbf7", light: "#221a13" },
};

export function crossColour(style: MapStyle, choice: CrossColour): string {
  if (choice === "auto") return THEMES[style].cross;
  return CROSS_COLOURS[choice][style];
}

/** Choropleth colour for a share t ∈ (0, 1] of the busiest country's visits (log-scaled by the caller). */
export function rampColour(theme: MapTheme, t: number): string {
  const i = Math.min(theme.ramp.length - 1, Math.max(0, Math.floor(t * theme.ramp.length - 1e-9)));
  return theme.ramp[i];
}

/** Google Maps `styles` array matching each palette (raster maps only; no Map ID). */
export function googleStyles(style: MapStyle): object[] {
  const t = THEMES[style];
  const dark = style === "dark";
  return [
    { elementType: "geometry", stylers: [{ color: t.land }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: dark ? "#c3aa82" : "#5e4f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: dark ? "#0d1124" : "#f6f1e8" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: t.sea }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: dark ? "#4b62a6" : "#a88c62" }] },
    { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: dark ? "#b8893b" : "#76644f" }, { weight: 0.8 }] },
    { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: dark ? "#5e421d" : "#c3aa82" }, { weight: 0.5 }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: dark ? "#283a70" : "#dccbac" }, { lightness: dark ? -20 : 10 }] },
    { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: t.land }] },
  ];
}
