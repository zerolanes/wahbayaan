"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { geoGraticule, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Feature, FeatureCollection, MultiLineString } from "geojson";
import { zoomToSplit } from "./cluster";
import type { EngineHandle, EngineProps } from "./engine";
import {
  applyView,
  clampK,
  clampView,
  DOUBLE_CLICK_ZOOM,
  easeInOutCubic,
  estimateVelocity,
  fitBaseProjection,
  homeView,
  INERTIA_DURATION,
  inertiaOffset,
  interpolateZoom,
  kToLevel,
  lngLatToScreen,
  MAX_K,
  MIN_K,
  panBy,
  projectionOutline,
  screenToLngLat,
  wheelFactor,
  zoomAround,
  type BaseProjection,
  type View,
  type Viewport,
} from "./geo";
import { numericToAlpha2 } from "./iso-numeric";
import { buildScreenMarkers, drawMarkers, hitTest } from "./markers";
import { crossColour, rampColour, THEMES } from "./theme";
import type { ScreenMarker } from "./types";

type CountryShape = { a2: string | undefined; f: Feature };
type WorldLayer = { countries: CountryShape[]; borders: MultiLineString; coast: MultiLineString };

/** Shapes are module-level so re-mounts (mode switches, HMR) don't re-parse them. */
let world110: Promise<WorldLayer> | null = null;
let world50: Promise<WorldLayer> | null = null;
let admin1: Promise<MultiLineString | null> | null = null;

const NAME_TO_A2: Record<string, string> = { Kosovo: "XK", "N. Cyprus": "CY", Somaliland: "SO" };

function toLayer(topo: Topology): WorldLayer {
  const obj = topo.objects.countries as GeometryCollection<{ name: string }>;
  const fc = feature(topo, obj) as FeatureCollection;
  return {
    countries: fc.features.map((f) => ({ a2: numericToAlpha2(f.id as string) ?? NAME_TO_A2[(f.properties as { name?: string })?.name ?? ""], f })),
    borders: mesh(topo, obj, (a, b) => a !== b),
    coast: mesh(topo, obj, (a, b) => a === b),
  };
}

function loadWorld110() {
  world110 ??= import("world-atlas/countries-110m.json").then((m) => toLayer(m.default as unknown as Topology));
  return world110;
}
function loadWorld50() {
  world50 ??= import("world-atlas/countries-50m.json").then((m) => toLayer(m.default as unknown as Topology));
  return world50;
}
function loadAdmin1() {
  admin1 ??= fetch("/geo/admin1.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((topo: Topology | null) => {
      if (!topo) return null;
      const obj = topo.objects.admin1 as GeometryCollection<{ n: string; c: string }>;
      return mesh(topo, obj, (a, b) => a !== b && (a.properties as { c?: string })?.c === (b.properties as { c?: string })?.c);
    })
    .catch(() => null);
  return admin1;
}

type Anim =
  | { kind: "path"; start: number; dur: number; fn: (t: number) => View; ease: (t: number) => number; done?: () => void }
  | { kind: "inertia"; start: number; vx: number; vy: number; last: { dx: number; dy: number } }
  | { kind: "wheel"; targetK: number; ax: number; ay: number; last: number };

const graticule = geoGraticule().step([30, 30])();

export function CanvasEngine(props: EngineProps & { ref?: Ref<EngineHandle> }) {
  const { ref } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const P = useRef(props);
  P.current = props;

  // Mutable engine state lives in one ref; React never re-renders for camera moves.
  const S = useRef({
    vp: { width: 1, height: 1 } as Viewport,
    dpr: 1,
    bp: null as BaseProjection | null,
    view: { cx: 0, cy: 0, k: 1 } as View,
    anim: null as Anim | null,
    world: null as WorldLayer | null,
    world50: null as WorldLayer | null,
    admin1: null as MultiLineString | null,
    baseDirty: true,
    markersDirty: true,
    screen: [] as ScreenMarker[],
    appeared: new Map<string, number>(),
    lastOverlay: 0,
    ambient: false,
    raf: 0,
    pointers: new Map<number, { x: number; y: number }>(),
    drag: null as null | { id: number; x: number; y: number; sx: number; sy: number; moved: boolean; samples: { x: number; y: number; t: number }[] },
    pinch: null as null | { dist: number; mx: number; my: number },
    lastStatus: "",
  });

  /* ------------------------------------------------------------ camera helpers */

  const setView = (v: View) => {
    const s = S.current;
    s.view = s.bp ? clampView(v, s.bp.bounds) : v;
    s.baseDirty = true;
    s.markersDirty = true;
  };

  const cancel = () => {
    const s = S.current;
    if (s.anim && s.anim.kind === "path") s.anim.done = undefined;
    s.anim = null;
  };

  const animatePath = (target: View, ms: number, done?: () => void, kind: "fly" | "zoom" = "fly") => {
    const s = S.current;
    if (!s.bp) return;
    const reduced = P.current.reducedMotion;
    if (ms <= 0 || reduced) {
      s.anim = null;
      setView(target);
      wake();
      done?.();
      return;
    }
    const from = s.view;
    let fn: (t: number) => View;
    if (kind === "fly") {
      const W = s.vp.width;
      const z = interpolateZoom([from.cx, from.cy, W / from.k], [target.cx, target.cy, W / target.k]);
      fn = (t) => {
        const [cx, cy, w] = z(t);
        return { cx, cy, k: clampK(W / w, MIN_K * 0.85, MAX_K) };
      };
    } else {
      // Zoom in log space around a fixed centre.
      const lk0 = Math.log(from.k);
      const lk1 = Math.log(target.k);
      fn = (t) => ({ cx: from.cx + (target.cx - from.cx) * t, cy: from.cy + (target.cy - from.cy) * t, k: Math.exp(lk0 + (lk1 - lk0) * t) });
    }
    s.anim = { kind: "path", start: performance.now(), dur: ms, fn, ease: easeInOutCubic, done };
    wake();
  };

  const viewFor = (lng: number, lat: number, k: number): View | null => {
    const s = S.current;
    const p = s.bp?.base([lng, lat]);
    if (!p) return null;
    return { cx: p[0], cy: p[1], k: clampK(k) };
  };

  /* ------------------------------------------------------------ imperative API */

  useImperativeHandle(
    ref,
    (): EngineHandle => ({
      flyTo(lng, lat, k, ms, onDone) {
        const v = viewFor(lng, lat, k);
        if (v) animatePath(v, ms, onDone);
      },
      flyToBounds([[w, so], [e, n]], ms, onDone) {
        const s = S.current;
        if (!s.bp) return;
        const a = s.bp.base([w, n]);
        const b = s.bp.base([e, so]);
        if (!a || !b) return;
        const bw = Math.abs(b[0] - a[0]) || 1;
        const bh = Math.abs(b[1] - a[1]) || 1;
        const k = clampK(Math.min((s.vp.width * 0.7) / bw, (s.vp.height * 0.7) / bh));
        animatePath({ cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, k }, ms, onDone);
      },
      home(ms, onDone) {
        const s = S.current;
        if (s.bp) animatePath(homeView(s.bp), ms, onDone);
      },
      zoomBy(factor, ms) {
        const s = S.current;
        const base = s.anim?.kind === "path" ? s.anim.fn(1) : s.view;
        cancel();
        const target = zoomAround(base, factor, s.vp.width / 2, s.vp.height / 2, s.vp);
        animatePath(target, ms, undefined, "zoom");
      },
      panBy(dx, dy) {
        cancel();
        setView(panBy(S.current.view, dx, dy));
        wake();
      },
      separate(marker, ms) {
        const s = S.current;
        const k = zoomToSplit(
          marker.members.map((m) => {
            const p = lngLatToScreen(s.bp!, s.view, s.vp, m.lng, m.lat);
            return { x: p?.[0] ?? marker.x, y: p?.[1] ?? marker.y, weight: m.visits };
          }),
          s.view.k,
        );
        // Centre on the members' midpoint so they spread around the middle of the screen.
        let bx = 0;
        let by = 0;
        let n = 0;
        for (const m of marker.members) {
          const p = s.bp?.base([m.lng, m.lat]);
          if (p) {
            bx += p[0];
            by += p[1];
            n++;
          }
        }
        if (!n) return;
        animatePath({ cx: bx / n, cy: by / n, k }, ms);
      },
      cancel,
      getZoom: () => S.current.view.k,
      markerPosition(id) {
        const m = S.current.screen.find((x) => x.id === id);
        return m ? { x: m.x, y: m.y, size: m.size } : null;
      },
      getScreenMarkers: () => S.current.screen,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ------------------------------------------------------------ rendering */

  const renderBase = () => {
    const s = S.current;
    const canvas = baseRef.current;
    if (!canvas || !s.bp) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { settings, choropleth } = P.current;
    const theme = THEMES[settings.style];
    const { width, height } = s.vp;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.fillStyle = theme.space;
    ctx.fillRect(0, 0, width, height);
    const proj = applyView(s.bp, s.view, s.vp);
    const path = geoPath(proj, ctx);
    const outline = s.bp.name === "mercator" ? null : (projectionOutline(s.bp.name) as GeoPermissibleObjects);

    // Sea with a soft light in the middle.
    ctx.beginPath();
    if (outline) path(outline);
    else {
      const [[x0, y0], [x1, y1]] = s.bp.bounds;
      const a = [(x0 - s.view.cx) * s.view.k + width / 2, (y0 - s.view.cy) * s.view.k + height / 2];
      const b = [(x1 - s.view.cx) * s.view.k + width / 2, (y1 - s.view.cy) * s.view.k + height / 2];
      ctx.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    }
    const g = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.75);
    g.addColorStop(0, theme.seaGlow);
    g.addColorStop(1, theme.sea);
    ctx.fillStyle = g;
    ctx.fill();

    if (s.view.k < 10) {
      ctx.beginPath();
      path(graticule);
      ctx.strokeStyle = theme.graticule;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    const layer = s.view.k >= 4 && s.world50 ? s.world50 : s.world;
    if (!layer) return;
    // Land first, then the choropleth on top, grouped by colour so each is one path.
    // Shading fades as you zoom in so borders and crosses stay the focus.
    ctx.beginPath();
    for (const c of layer.countries) path(c.f);
    ctx.fillStyle = theme.land;
    ctx.fill();
    const groups = new Map<string, Feature[]>();
    for (const c of layer.countries) {
      const t = c.a2 ? choropleth.get(c.a2) : undefined;
      if (!t) continue;
      const colour = rampColour(theme, t);
      const list = groups.get(colour);
      if (list) list.push(c.f);
      else groups.set(colour, [c.f]);
    }
    ctx.globalAlpha = Math.max(0.35, Math.min(1, 1 - Math.log2(s.view.k) / 6));
    for (const [colour, feats] of groups) {
      ctx.beginPath();
      for (const f of feats) path(f);
      ctx.fillStyle = colour;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const zoomWidth = Math.min(1.6, 1 + Math.log10(s.view.k) * 0.25);
    if (s.view.k >= 4 && s.admin1) {
      ctx.beginPath();
      path(s.admin1);
      ctx.strokeStyle = theme.admin1;
      ctx.lineWidth = 0.6 * zoomWidth;
      ctx.setLineDash([2, 2.5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    path(layer.borders);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 0.6 * zoomWidth;
    ctx.stroke();
    ctx.beginPath();
    path(layer.coast);
    ctx.strokeStyle = theme.coast;
    ctx.lineWidth = 0.85 * zoomWidth;
    ctx.stroke();
  };

  const rebuildMarkers = () => {
    const s = S.current;
    if (!s.bp) return;
    const { markers, settings, latestId } = P.current;
    s.screen = buildScreenMarkers(markers, (lng, lat) => lngLatToScreen(s.bp!, s.view, s.vp, lng, lat), s.vp, { sizeMultiplier: settings.crossSize, latestId });
  };

  const renderOverlay = (now: number) => {
    const s = S.current;
    const canvas = overlayRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { settings, hoverId, pinnedId, reducedMotion } = P.current;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.vp.width, s.vp.height);
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
      dpr: s.dpr,
    });
    s.lastOverlay = now;
  };

  const writeStatus = () => {
    const s = S.current;
    const el = P.current.statusRef.current;
    if (!el) return;
    const clusters = s.screen.filter((m) => m.members.length > 1).length;
    const center = s.bp ? screenToLngLat(s.bp, s.view, s.vp, s.vp.width / 2, s.vp.height / 2) : null;
    const status = `${s.view.k.toFixed(3)}|${s.screen.length}|${clusters}|${s.anim ? 1 : 0}|${center?.[0].toFixed(3)},${center?.[1].toFixed(3)}`;
    if (status === s.lastStatus) return;
    s.lastStatus = status;
    el.dataset.zoom = s.view.k.toFixed(3);
    el.dataset.zoomLevel = kToLevel(s.view.k).toFixed(2);
    el.dataset.markers = String(s.screen.length);
    el.dataset.clusters = String(clusters);
    el.dataset.animating = s.anim ? "1" : "0";
    if (center) el.dataset.center = `${center[0].toFixed(3)},${center[1].toFixed(3)}`;
    P.current.onViewChange?.(s.view.k);
  };

  /* ------------------------------------------------------------ frame loop */

  const tick = (now: number) => {
    const s = S.current;
    s.raf = 0;
    const a = s.anim;
    if (a?.kind === "path") {
      const t = Math.min(1, (now - a.start) / a.dur);
      setView(a.fn(a.ease(t)));
      if (t >= 1) {
        s.anim = null;
        a.done?.();
      }
    } else if (a?.kind === "inertia") {
      const t = now - a.start;
      const dx = inertiaOffset(a.vx, t);
      const dy = inertiaOffset(a.vy, t);
      setView(panBy(s.view, dx - a.last.dx, dy - a.last.dy));
      a.last = { dx, dy };
      if (t >= INERTIA_DURATION) s.anim = null;
    } else if (a?.kind === "wheel") {
      // Ease towards the wheel's target zoom: smooth, but done within ~150 ms.
      const dt = Math.min(500, Math.max(1, now - a.last));
      a.last = now;
      const ratio = a.targetK / s.view.k;
      const step = Math.abs(Math.log(ratio)) < 0.002 ? ratio : Math.pow(ratio, 1 - Math.exp(-dt / 45));
      setView(zoomAround(s.view, step, a.ax, a.ay, s.vp));
      if (step === ratio) s.anim = null;
    }
    if (s.baseDirty) {
      renderBase();
      s.baseDirty = false;
      maybeLoadDetail();
    }
    let drew = false;
    if (s.markersDirty) {
      rebuildMarkers();
      s.markersDirty = false;
      renderOverlay(now);
      drew = true;
    } else if (s.ambient && !P.current.reducedMotion && now - s.lastOverlay > 33) {
      renderOverlay(now);
      drew = true;
    }
    if (drew || a) writeStatus();
    if (s.anim || s.ambient) schedule();
  };

  const schedule = () => {
    const s = S.current;
    if (!s.raf && typeof document !== "undefined" && !document.hidden) s.raf = requestAnimationFrame(tick);
  };
  const wake = () => schedule();

  const maybeLoadDetail = () => {
    const s = S.current;
    if (s.view.k >= 3.5 && !s.world50) {
      loadWorld50().then((w) => {
        S.current.world50 = w;
        S.current.baseDirty = true;
        wake();
      });
    }
    if (s.view.k >= 3.5 && !s.admin1) {
      loadAdmin1().then((m) => {
        if (!m) return;
        S.current.admin1 = m;
        S.current.baseDirty = true;
        wake();
      });
    }
  };

  /* ------------------------------------------------------------ setup: size, data, events */

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const s = S.current;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (width === s.vp.width && height === s.vp.height && dpr === s.dpr && s.bp) return;
      // Keep the same geographic centre and zoom across resizes.
      const centre = s.bp ? screenToLngLat(s.bp, s.view, s.vp, s.vp.width / 2, s.vp.height / 2) : null;
      const hadView = !!s.bp;
      s.vp = { width, height };
      s.dpr = dpr;
      for (const c of [baseRef.current, overlayRef.current]) {
        if (!c) continue;
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
      }
      s.bp = fitBaseProjection(P.current.settings.projection, s.vp);
      if (hadView && centre) {
        const p = s.bp.base(centre);
        setView(p ? { cx: p[0], cy: p[1], k: s.view.k } : homeView(s.bp));
      } else setView(homeView(s.bp));
      s.baseDirty = true;
      s.markersDirty = true;
      wake();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    loadWorld110().then((w) => {
      S.current.world = w;
      S.current.baseDirty = true;
      wake();
    });
    const onVis = () => {
      if (!document.hidden) {
        S.current.markersDirty = true;
        wake();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      if (S.current.raf) cancelAnimationFrame(S.current.raf);
      S.current.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Projection change: refit, keep the centre and zoom.
  const projection = props.settings.projection;
  useEffect(() => {
    const s = S.current;
    if (!s.bp || s.bp.name === projection) return;
    const centre = screenToLngLat(s.bp, s.view, s.vp, s.vp.width / 2, s.vp.height / 2);
    s.bp = fitBaseProjection(projection, s.vp);
    const p = centre ? s.bp.base(centre) : null;
    cancel();
    setView(p ? { cx: p[0], cy: p[1], k: s.view.k } : homeView(s.bp));
    wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection]);

  // Anything visual changed → redraw.
  const { markers, choropleth, latestId, settings, hoverId, pinnedId, reducedMotion } = props;
  useEffect(() => {
    S.current.baseDirty = true;
    wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choropleth, settings.style]);
  useEffect(() => {
    S.current.markersDirty = true;
    wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, latestId, settings, hoverId, pinnedId, reducedMotion]);

  // Pointer, wheel and touch handling on the overlay canvas.
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const s = S.current;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onWheel = (e: WheelEvent) => {
      const allowed = P.current.wheelActiveRef.current || e.ctrlKey || e.metaKey;
      if (!allowed) {
        P.current.onWheelBlocked();
        return;
      }
      e.preventDefault();
      P.current.onUserInteract();
      const { x, y } = local(e);
      const f = wheelFactor(e.deltaY, e.deltaMode, s.vp.height);
      if (P.current.reducedMotion) {
        cancel();
        setView(zoomAround(s.view, f, x, y, s.vp));
        wake();
        return;
      }
      const cur = s.anim?.kind === "wheel" ? s.anim.targetK : s.view.k;
      s.anim = { kind: "wheel", targetK: clampK(cur * f), ax: x, ay: y, last: performance.now() };
      wake();
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        /* synthetic or already-released pointer */
      }
      const p = local(e);
      s.pointers.set(e.pointerId, p);
      cancel();
      P.current.onUserInteract();
      if (s.pointers.size === 1) {
        s.drag = { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false, samples: [{ x: p.x, y: p.y, t: e.timeStamp }] };
        s.pinch = null;
      } else if (s.pointers.size === 2) {
        const [a, b] = [...s.pointers.values()];
        s.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        if (s.drag) s.drag.moved = true;
      }
    };

    const onMove = (e: PointerEvent) => {
      const p = local(e);
      if (!s.pointers.has(e.pointerId)) {
        if (e.pointerType === "mouse") {
          const hit = hitTest(s.screen, p.x, p.y);
          el.style.cursor = hit ? "pointer" : "grab";
          if ((hit?.id ?? null) !== P.current.hoverId) P.current.onHover(hit);
        }
        return;
      }
      s.pointers.set(e.pointerId, p);
      if (s.pinch && s.pointers.size >= 2) {
        const [a, b] = [...s.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        // Zoom around the fingers' midpoint while following it.
        let v = zoomAround(s.view, dist / s.pinch.dist, s.pinch.mx, s.pinch.my, s.vp);
        v = panBy(v, mx - s.pinch.mx, my - s.pinch.my);
        setView(v);
        s.pinch = { dist, mx, my };
        wake();
        return;
      }
      const d = s.drag;
      if (!d || d.id !== e.pointerId) return;
      if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 3) {
        d.moved = true;
        el.style.cursor = "grabbing";
        if (P.current.hoverId) P.current.onHover(null);
      }
      if (d.moved) {
        setView(panBy(s.view, p.x - d.x, p.y - d.y));
        wake();
      }
      d.x = p.x;
      d.y = p.y;
      // Velocity uses the events' own timestamps (incl. coalesced moves), not handler time.
      const r = el.getBoundingClientRect();
      const evs = e.getCoalescedEvents?.() ?? [];
      for (const ce of evs.length ? evs : [e]) d.samples.push({ x: ce.clientX - r.left, y: ce.clientY - r.top, t: ce.timeStamp });
      if (d.samples.length > 24) d.samples.splice(0, d.samples.length - 24);
    };

    const onUp = (e: PointerEvent) => {
      if (!s.pointers.has(e.pointerId)) return;
      s.pointers.delete(e.pointerId);
      const d = s.drag;
      if (s.pinch) {
        if (s.pointers.size < 2) s.pinch = null;
        if (s.pointers.size === 1) {
          // Continue as a one-finger drag from the remaining finger without a jump.
          const [[id, p]] = [...s.pointers.entries()];
          s.drag = { id, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: true, samples: [{ x: p.x, y: p.y, t: performance.now() }] };
        } else s.drag = null;
        return;
      }
      s.drag = null;
      el.style.cursor = "grab";
      if (!d || d.id !== e.pointerId || e.type === "pointercancel") return;
      if (d.moved) {
        const [vx, vy] = estimateVelocity(d.samples);
        const idle = e.timeStamp - (d.samples[d.samples.length - 1]?.t ?? 0);
        if (!P.current.reducedMotion && idle < 100 && Math.hypot(vx, vy) > 0.05) {
          s.anim = { kind: "inertia", start: performance.now(), vx, vy, last: { dx: 0, dy: 0 } };
          wake();
        }
        return;
      }
      const p = local(e);
      P.current.onSelect(hitTest(s.screen, p.x, p.y));
    };

    const onDbl = (e: MouseEvent) => {
      e.preventDefault();
      P.current.onUserInteract();
      const { x, y } = local(e);
      const factor = e.shiftKey ? 1 / DOUBLE_CLICK_ZOOM : DOUBLE_CLICK_ZOOM;
      cancel();
      animatePath(zoomAround(s.view, factor, x, y, s.vp), 300, undefined, "zoom");
    };

    const onLeave = () => {
      if (P.current.hoverId && !s.drag) P.current.onHover(null);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("dblclick", onDbl);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("dblclick", onDbl);
      el.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden" data-engine="builtin">
      <canvas ref={baseRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <canvas ref={overlayRef} className="absolute inset-0 h-full w-full cursor-grab touch-none select-none" role="img" aria-label={props.ariaLabel} />
    </div>
  );
}
