import type { RefObject } from "react";
import type { GeoMarker, ScreenMarker, VisitorMapSettings } from "./types";

/** What the orchestrator can ask either map engine (built-in canvas or Google Maps) to do. */
export type EngineHandle = {
  /** Fly to a point at zoom factor k. ms = 0 jumps. */
  flyTo(lng: number, lat: number, k: number, ms: number, onDone?: () => void): void;
  /** Fly so that the lng/lat box fills the view. */
  flyToBounds(bounds: [[number, number], [number, number]], ms: number, onDone?: () => void): void;
  home(ms: number, onDone?: () => void): void;
  zoomBy(factor: number, ms: number): void;
  panBy(dx: number, dy: number): void;
  /** Fly in on a merged cross until its places separate. */
  separate(marker: ScreenMarker, ms: number): void;
  cancel(): void;
  getZoom(): number;
  /** Screen position of a marker id (for tooltips that follow the map). */
  markerPosition(id: string): { x: number; y: number; size: number } | null;
  /** The crosses drawn right now, in map-area pixels. */
  getScreenMarkers(): ScreenMarker[];
};

export type EngineProps = {
  markers: GeoMarker[];
  /** ISO alpha-2 → share of the busiest country's visits (0–1, log scaled). */
  choropleth: Map<string, number>;
  latestId: string | null;
  settings: VisitorMapSettings;
  hoverId: string | null;
  pinnedId: string | null;
  reducedMotion: boolean;
  /** Element that receives data-zoom / data-markers / data-clusters / data-animating. */
  statusRef: RefObject<HTMLElement | null>;
  /** Whether plain wheel events may zoom (after the map was clicked). */
  wheelActiveRef: RefObject<boolean>;
  ariaLabel: string;
  onHover(marker: ScreenMarker | null): void;
  onSelect(marker: ScreenMarker | null): void;
  /** Any drag, wheel, pinch or click — cancels auto-fly. */
  onUserInteract(): void;
  /** A wheel event arrived before the map was activated. */
  onWheelBlocked(): void;
  /** Called whenever the camera settles or moves (throttled to animation frames). */
  onViewChange?(k: number): void;
};
