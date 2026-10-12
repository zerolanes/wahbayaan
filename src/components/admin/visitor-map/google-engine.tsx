"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { EngineHandle, EngineProps } from "./engine";
import { HOME_LNG_LAT, kToLevel } from "./geo";
import { buildScreenMarkers, drawMarkers, hitTest } from "./markers";
import { crossColour, googleStyles, THEMES } from "./theme";
import type { ScreenMarker } from "./types";

/* Minimal typings for the bits of the Maps JavaScript API we use (no @types dependency). */
type LatLng = { lat(): number; lng(): number };
type Point = { x: number; y: number };
type GMap = {
  getZoom(): number | undefined;
  setZoom(z: number): void;
  setCenter(c: { lat: number; lng: number }): void;
  panTo(c: { lat: number; lng: number }): void;
  panBy(x: number, y: number): void;
  setOptions(o: object): void;
  fitBounds(b: object, padding?: number): void;
  getDiv(): HTMLElement;
  addListener(ev: string, fn: (e: { latLng?: LatLng; domEvent?: MouseEvent }) => void): { remove(): void };
};
type Projection = { fromLatLngToContainerPixel(l: object): Point | null };
type OverlayView = { setMap(m: GMap | null): void; getProjection(): Projection | null; onAdd?: () => void; draw?: () => void; onRemove?: () => void };
type GoogleMaps = {
  Map: new (el: HTMLElement, o: object) => GMap;
  LatLng: new (lat: number, lng: number) => object;
  LatLngBounds: new (sw: object, ne: object) => object;
  OverlayView: new () => OverlayView;
  event: { addListenerOnce(target: object, ev: string, fn: () => void): void };
};

let loader: Promise<GoogleMaps> | null = null;

/** Loads the Maps JavaScript API once, only when a key has been saved in Admin → Settings. */
export function loadGoogleMaps(key: string): Promise<GoogleMaps> {
  const w = window as unknown as { google?: { maps?: GoogleMaps }; __wbVisitorMapReady?: () => void };
  if (w.google?.maps?.Map) return Promise.resolve(w.google.maps);
  loader ??= new Promise<GoogleMaps>((resolve, reject) => {
    w.__wbVisitorMapReady = () => (w.google?.maps ? resolve(w.google.maps) : reject(new Error("Google Maps failed to load")));
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&callback=__wbVisitorMapReady&loading=async`;
    s.async = true;
    s.onerror = () => {
      loader = null;
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(s);
  });
  return loader;
}

export function GoogleEngine(props: EngineProps & { apiKey: string; onFail(): void; ref?: Ref<EngineHandle> }) {
  const { ref, apiKey } = props;
  const P = useRef(props);
  P.current = props;
  const mapDiv = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const S = useRef({
    g: null as GoogleMaps | null,
    map: null as GMap | null,
    overlay: null as OverlayView | null,
    screen: [] as ScreenMarker[],
    appeared: new Map<string, number>(),
    raf: 0,
    ambient: false,
    minZoom: 1,
    pending: null as null | (() => void),
  });

  const zoomToK = (z: number) => Math.pow(2, z - S.current.minZoom);
  const kToZoom = (k: number) => Math.round(S.current.minZoom + Math.log2(Math.max(1, k)));

  const draw = () => {
    const s = S.current;
    s.raf = 0;
    const canvas = canvasRef.current;
    const proj = s.overlay?.getProjection();
    if (!canvas || !proj || !s.g) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(rect.width);
    const H = Math.round(rect.height);
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    const { markers, settings, latestId, hoverId, pinnedId, reducedMotion } = P.current;
    const g = s.g;
    s.screen = buildScreenMarkers(
      markers,
      (lng, lat) => {
        const p = proj.fromLatLngToContainerPixel(new g.LatLng(lat, lng));
        return p ? [p.x, p.y] : null;
      },
      { width: W, height: H },
      { sizeMultiplier: settings.crossSize, latestId },
    );
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const now = performance.now();
    s.ambient = drawMarkers(ctx, s.screen, {
      theme: THEMES[settings.style],
      colour: crossColour(settings.style, settings.crossColour),
      crossStyle: settings.crossStyle,
      now,
      speed: settings.animationSpeed,
      reducedMotion,
      hoverId,
      pinnedId,
      labels: settings.labels,
      showRanks: settings.mode === "top10",
      appeared: s.appeared,
      dpr,
    });
    const el = P.current.statusRef.current;
    const k = zoomToK(s.map?.getZoom() ?? s.minZoom);
    if (el) {
      el.dataset.zoom = k.toFixed(3);
      el.dataset.zoomLevel = kToLevel(k).toFixed(2);
      el.dataset.markers = String(s.screen.length);
      el.dataset.clusters = String(s.screen.filter((m) => m.members.length > 1).length);
    }
    if (s.ambient && !reducedMotion) setTimeout(schedule, 33);
  };
  const schedule = () => {
    if (!S.current.raf) S.current.raf = requestAnimationFrame(draw);
  };

  useEffect(() => {
    let cancelled = false;
    const listeners: { remove(): void }[] = [];
    // Google calls this global when the key is rejected (wrong key, referrer not allowed, billing off).
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => P.current.onFail();
    loadGoogleMaps(apiKey)
      .then((g) => {
        if (cancelled || !mapDiv.current) return;
        const s = S.current;
        s.g = g;
        const width = mapDiv.current.clientWidth || 1024;
        s.minZoom = Math.max(1, Math.log2(width / 256));
        const map = new g.Map(mapDiv.current, {
          center: { lat: HOME_LNG_LAT[1], lng: HOME_LNG_LAT[0] },
          zoom: Math.round(s.minZoom),
          minZoom: Math.floor(s.minZoom),
          styles: googleStyles(P.current.settings.style),
          disableDefaultUI: true,
          gestureHandling: "cooperative",
          backgroundColor: THEMES[P.current.settings.style].sea,
          clickableIcons: false,
          keyboardShortcuts: false,
        });
        s.map = map;
        const overlay = new g.OverlayView();
        overlay.onAdd = () => {};
        overlay.draw = schedule;
        overlay.onRemove = () => {};
        overlay.setMap(map);
        s.overlay = overlay;
        const px = (e: { latLng?: LatLng }) => {
          const proj = overlay.getProjection();
          return e.latLng && proj ? proj.fromLatLngToContainerPixel(e.latLng) : null;
        };
        listeners.push(
          map.addListener("bounds_changed", schedule),
          map.addListener("dragstart", () => P.current.onUserInteract()),
          map.addListener("mousemove", (e) => {
            const p = px(e);
            const hit = p ? hitTest(s.screen, p.x, p.y) : null;
            if ((hit?.id ?? null) !== P.current.hoverId) P.current.onHover(hit);
          }),
          map.addListener("click", (e) => {
            P.current.onUserInteract();
            const p = px(e);
            P.current.onSelect(p ? hitTest(s.screen, p.x, p.y) : null);
          }),
          map.addListener("idle", () => {
            const done = s.pending;
            s.pending = null;
            done?.();
            schedule();
          }),
        );
        setReady(true);
      })
      .catch(() => P.current.onFail());
    return () => {
      cancelled = true;
      listeners.forEach((l) => l.remove());
      S.current.overlay?.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const { markers, settings, latestId, hoverId, pinnedId, reducedMotion } = props;
  useEffect(() => {
    S.current.map?.setOptions({ styles: googleStyles(settings.style), backgroundColor: THEMES[settings.style].sea });
  }, [settings.style]);
  useEffect(() => {
    if (ready) schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, markers, settings, latestId, hoverId, pinnedId, reducedMotion]);

  const go = (lat: number, lng: number, zoom: number, ms: number, done?: () => void) => {
    const map = S.current.map;
    if (!map) return;
    if (ms <= 0 || P.current.reducedMotion) {
      map.setCenter({ lat, lng });
      map.setZoom(zoom);
      done?.();
      return;
    }
    // Raster maps can't animate fractional zoom: pan smoothly, then zoom once it settles.
    S.current.pending = () => {
      map.setZoom(zoom);
      S.current.pending = done ?? null;
    };
    map.panTo({ lat, lng });
  };

  useImperativeHandle(
    ref,
    (): EngineHandle => ({
      flyTo: (lng, lat, k, ms, done) => go(lat, lng, kToZoom(k), ms, done),
      flyToBounds([[w, so], [e, n]], _ms, done) {
        const s = S.current;
        if (!s.map || !s.g) return;
        s.map.fitBounds(new s.g.LatLngBounds(new s.g.LatLng(so, w), new s.g.LatLng(n, e)), 40);
        s.pending = done ?? null;
      },
      home: (ms, done) => go(HOME_LNG_LAT[1], HOME_LNG_LAT[0], Math.round(S.current.minZoom), ms, done),
      zoomBy(factor) {
        const map = S.current.map;
        if (map) map.setZoom((map.getZoom() ?? 2) + Math.round(Math.log2(factor) || Math.sign(factor - 1)));
      },
      panBy: (dx, dy) => S.current.map?.panBy(-dx, -dy),
      separate(marker, ms) {
        const lat = marker.members.reduce((a, m) => a + m.lat, 0) / marker.members.length;
        const lng = marker.members.reduce((a, m) => a + m.lng, 0) / marker.members.length;
        go(lat, lng, Math.min(18, (S.current.map?.getZoom() ?? 3) + 3), ms);
      },
      cancel: () => {
        S.current.pending = null;
      },
      getZoom: () => zoomToK(S.current.map?.getZoom() ?? S.current.minZoom),
      markerPosition(id) {
        const m = S.current.screen.find((x) => x.id === id);
        return m ? { x: m.x, y: m.y, size: m.size } : null;
      },
      getScreenMarkers: () => S.current.screen,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="absolute inset-0" data-engine="google">
      <div ref={mapDiv} className="absolute inset-0" role="region" aria-label={props.ariaLabel} />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  );
}
