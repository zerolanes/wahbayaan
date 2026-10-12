"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CanvasEngine } from "./canvas-engine";
import { ControlsCard, SettingsPanel } from "./controls";
import type { EngineHandle } from "./engine";
import { Flag } from "./flags";
import { BUTTON_ZOOM, levelToK } from "./geo";
import { GoogleEngine } from "./google-engine";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";
import { buildMarkers, filterValue, placeLabel, relativeTime } from "./data";
import type { MapLatest, ScreenMarker, VisitorMapData, VisitorMapSettings, VisitorMapTestHooks } from "./types";

export type VisitorMapProps = {
  mode: "background" | "card";
  tableFilterParam: string;
  dataUrl: string;
  /** Start with the controls collapsed to a title bar (phones always do). */
  compact: boolean;
  userId: string | null;
  googleMapsKey: string | null;
};

type FlyPhase = "idle" | "to" | "hold" | "back";

const PAN_STEP = 80;

/** Duration of a user-triggered camera move: 0 (a jump) under reduced motion. */
function uiMs(ms: number, reduced: boolean) {
  return reduced ? 0 : ms * (testHooks().animScale ?? 1);
}

function testHooks(): VisitorMapTestHooks {
  if (typeof window === "undefined") return {};
  return (window as unknown as { __VM_TEST__?: VisitorMapTestHooks }).__VM_TEST__ ?? {};
}

export function VisitorMap({ mode, tableFilterParam, dataUrl, compact, userId, googleMapsKey }: VisitorMapProps) {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);
  const engine = useRef<EngineHandle>(null);
  const wheelActive = useRef(false);

  const [settings, setSettings] = useState<VisitorMapSettings>(() => (typeof window === "undefined" ? DEFAULT_SETTINGS : loadSettings(userId)));
  const updateSettings = useCallback(
    (patch: Partial<VisitorMapSettings>) =>
      setSettings((s) => {
        const next = { ...s, ...patch };
        saveSettings(userId, next);
        return next;
      }),
    [userId],
  );

  const [data, setData] = useState<VisitorMapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<ScreenMarker | null>(null);
  const [pinned, setPinned] = useState<ScreenMarker | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => compact || (typeof window !== "undefined" && window.innerWidth < 640));
  const [newVisit, setNewVisit] = useState<{ latest: MapLatest; fresh: boolean } | null>(null);
  const [phase, setPhase] = useState<FlyPhase>("idle");
  const [wheelHint, setWheelHint] = useState(false);
  const [wheelOn, setWheelOn] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [googleFailed, setGoogleFailed] = useState(false);
  const [, setViewTick] = useState(0);
  const [isMac, setIsMac] = useState(false);

  // Refs mirror the state the timers and engine callbacks need to read.
  const R = useRef({ hover, pinned, settingsOpen, phase, settings, reducedMotion });
  R.current = { hover, pinned, settingsOpen, phase, settings, reducedMotion };
  const timers = useRef<{ hold?: ReturnType<typeof setTimeout>; start?: ReturnType<typeof setTimeout>; card?: ReturnType<typeof setTimeout>; hint?: ReturnType<typeof setTimeout>; retry?: ReturnType<typeof setTimeout> }>({});
  const lastLatest = useRef<string | null>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setReducedMotion(mq.matches);
    set();
    mq.addEventListener("change", set);
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    return () => mq.removeEventListener("change", set);
  }, []);

  /* ---------------------------------------------------------------- data */

  const effectiveRange = settings.everyPlace ? "all" : settings.range;
  const query = `range=${effectiveRange}&live=${settings.liveOnly ? 1 : 0}&hideDc=${settings.hideDatacenter ? 1 : 0}`;
  const pollMs = testHooks().pollMs ?? settings.pollSeconds * 1000;

  useEffect(() => {
    let alive = true;
    let ctrl: AbortController | null = null;
    const load = async () => {
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const res = await fetch(`${dataUrl}${dataUrl.includes("?") ? "&" : "?"}${query}`, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "Staff only" : `Couldn't load visitors (${res.status})`);
        const json = (await res.json()) as VisitorMapData;
        if (alive) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (alive && (e as Error).name !== "AbortError") setError((e as Error).message);
      }
    };
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
      ctrl?.abort();
    };
  }, [dataUrl, query, pollMs]);

  const markers = useMemo(() => buildMarkers(data, settings), [data, settings]);
  const choropleth = useMemo(() => {
    const m = new Map<string, number>();
    const max = Math.max(1, ...(data?.countries ?? []).map((c) => c.visits));
    for (const c of data?.countries ?? []) if (c.visits > 0) m.set(c.countryCode, Math.log1p(c.visits) / Math.log1p(max));
    return m;
  }, [data]);
  const latestId = data?.latest ? (settings.mode === "countries" ? `country:${data.latest.countryCode}` : data.latest.key) : null;

  /* ---------------------------------------------------------------- auto-fly */

  const blocked = () => !!(R.current.hover || R.current.pinned || R.current.settingsOpen);
  const speed = () => R.current.settings.animationSpeed;
  const clearFlyTimers = () => {
    clearTimeout(timers.current.hold);
    clearTimeout(timers.current.retry);
  };

  const goHome = useCallback(() => {
    clearFlyTimers();
    if (blocked()) {
      // Wait until the user stops hovering / unpins / closes settings.
      timers.current.retry = setTimeout(goHome, 1000);
      return;
    }
    setPhase("back");
    const ms = R.current.reducedMotion ? 0 : (testHooks().homeMs ?? 1700) / speed();
    engine.current?.home(ms, () => {
      setPhase("idle");
      setNewVisit(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flyToLatest = useCallback(
    (latest: MapLatest, fresh: boolean) => {
      const s = R.current.settings;
      setNewVisit({ latest, fresh });
      clearTimeout(timers.current.card);
      if (!s.autoFly || blocked() || !engine.current) {
        timers.current.card = setTimeout(() => setNewVisit(null), 6000);
        return;
      }
      clearFlyTimers();
      setPhase("to");
      const ms = R.current.reducedMotion ? 0 : (testHooks().flyMs ?? 1700) / speed();
      const level = s.mode === "countries" ? Math.min(s.flyZoom, 4) : s.flyZoom;
      engine.current.flyTo(latest.lng, latest.lat, levelToK(level), ms, () => {
        setPhase("hold");
        timers.current.hold = setTimeout(goHome, testHooks().holdMs ?? s.flyHoldSeconds * 1000);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goHome],
  );

  const cancelFly = useCallback(() => {
    if (R.current.phase === "idle") return;
    clearFlyTimers();
    engine.current?.cancel();
    setPhase("idle");
    clearTimeout(timers.current.card);
    timers.current.card = setTimeout(() => setNewVisit(null), 4000);
  }, []);

  // New visit detection: first load flies after ~1.4 s; later polls fly when `latest` changes.
  useEffect(() => {
    const latest = data?.latest;
    if (!latest) return;
    const sig = `${latest.key}@${latest.at}`;
    if (firstLoad.current) {
      firstLoad.current = false;
      lastLatest.current = sig;
      timers.current.start = setTimeout(() => flyToLatest(latest, false), testHooks().startDelayMs ?? 1400);
      return;
    }
    if (sig !== lastLatest.current) {
      lastLatest.current = sig;
      flyToLatest(latest, true);
    }
  }, [data, flyToLatest]);

  // Test hook: expose crosses in page coordinates when an e2e test asks for it.
  useEffect(() => {
    const hooks = (window as unknown as { __VM_TEST__?: VisitorMapTestHooks }).__VM_TEST__;
    if (!hooks) return;
    hooks.api = {
      markers: () => {
        const r = mapAreaRef.current?.getBoundingClientRect();
        return (engine.current?.getScreenMarkers() ?? []).map((m) => ({ id: m.id, x: m.x + (r?.left ?? 0), y: m.y + (r?.top ?? 0), count: m.members.length, memberIds: m.members.map((x) => x.id) }));
      },
      zoom: () => engine.current?.getZoom() ?? 1,
    };
  }, []);

  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach((x) => clearTimeout(x));
    };
  }, []);

  /* ---------------------------------------------------------------- pin + table filter */

  const writeFilter = useCallback(
    (value: string | null) => {
      const params = new URLSearchParams(window.location.search);
      if (value) params.set(tableFilterParam, value);
      else params.delete(tableFilterParam);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, tableFilterParam],
  );

  const unpin = useCallback(() => {
    if (!R.current.pinned) return;
    setPinned(null);
    writeFilter(null);
  }, [writeFilter]);

  const onSelect = useCallback(
    (m: ScreenMarker | null) => {
      if (!m) {
        unpin();
        return;
      }
      if (m.members.length > 1) {
        setHover(null);
        engine.current?.separate(m, uiMs(750, R.current.reducedMotion));
        return;
      }
      if (R.current.pinned?.id === m.id) {
        unpin();
        return;
      }
      setPinned(m);
      writeFilter(filterValue(m.members[0]));
    },
    [unpin, writeFilter],
  );

  const onUserInteract = useCallback(() => {
    cancelFly();
    if (!wheelActive.current) {
      wheelActive.current = true;
      setWheelOn(true);
    }
  }, [cancelFly]);

  const onWheelBlocked = useCallback(() => {
    setWheelHint(true);
    clearTimeout(timers.current.hint);
    timers.current.hint = setTimeout(() => setWheelHint(false), 1600);
  }, []);

  // Clicking anywhere outside the map turns wheel-zoom back off.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node) && wheelActive.current) {
        wheelActive.current = false;
        setWheelOn(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (R.current.settingsOpen) setSettingsOpen(false);
      else unpin();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [unpin]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const eng = engine.current;
    if (!eng) return;
    const ms = uiMs(300, reducedMotion);
    const keys: Record<string, () => void> = {
      ArrowLeft: () => eng.panBy(PAN_STEP, 0),
      ArrowRight: () => eng.panBy(-PAN_STEP, 0),
      ArrowUp: () => eng.panBy(0, PAN_STEP),
      ArrowDown: () => eng.panBy(0, -PAN_STEP),
      "+": () => eng.zoomBy(BUTTON_ZOOM, ms),
      "=": () => eng.zoomBy(BUTTON_ZOOM, ms),
      "-": () => eng.zoomBy(1 / BUTTON_ZOOM, ms),
      _: () => eng.zoomBy(1 / BUTTON_ZOOM, ms),
      Home: () => eng.home(ms),
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      cancelFly();
      fn();
    }
  };

  const onViewChange = useCallback(() => {
    // Only re-render when a tooltip needs to follow the map.
    if (R.current.pinned || R.current.hover) setViewTick((t) => (t + 1) % 1e6);
  }, []);

  /* ---------------------------------------------------------------- controls */

  const zoom = (f: number) => {
    cancelFly();
    engine.current?.zoomBy(f, uiMs(300, reducedMotion));
  };
  const home = () => {
    cancelFly();
    engine.current?.home(uiMs(300, reducedMotion));
  };
  const fullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };

  const useGoogle = !!googleMapsKey && settings.engine === "auto" && !googleFailed;
  const tipMarker = pinned ?? hover;
  const tipPos = tipMarker ? (engine.current?.markerPosition(tipMarker.id) ?? { x: tipMarker.x, y: tipMarker.y, size: tipMarker.size }) : null;
  const stats = useMemo(() => {
    const places = data?.places ?? [];
    return {
      places: places.length,
      visits: places.reduce((s, p) => s + p.visits, 0),
      online: places.filter((p) => p.online).length,
    };
  }, [data]);
  const topPlaces = useMemo(() => [...(data?.places ?? [])].sort((a, b) => b.visits - a.visits).slice(0, 10), [data]);

  const bg = mode === "background";
  const engineProps = {
    markers,
    choropleth,
    latestId,
    settings,
    hoverId: hover?.id ?? null,
    pinnedId: pinned?.id ?? null,
    reducedMotion,
    statusRef: rootRef,
    wheelActiveRef: wheelActive,
    ariaLabel: `Visitor map: ${stats.places} places, ${stats.visits} visits${stats.online ? `, ${stats.online} online now` : ""}. Use arrow keys to pan, plus and minus to zoom, Home to reset.`,
    onHover: setHover,
    onSelect,
    onUserInteract,
    onWheelBlocked,
    onViewChange,
  };

  return (
    <div
      ref={rootRef}
      className={bg ? "vm-root vm-root-bg" : "vm-root vm-root-card"}
      data-visitor-map=""
      data-vm-background={bg ? "" : undefined}
      data-vm-style={settings.style}
      data-map-mode={settings.mode}
      data-fly-phase={phase}
      data-pinned={pinned ? filterValue(pinned.members[0]) : ""}
      data-wheel-active={wheelOn ? "1" : "0"}
      data-reduced-motion={reducedMotion ? "1" : "0"}
      data-engine={useGoogle ? "google" : "builtin"}
      data-loaded={data ? "1" : "0"}
    >
      <div
        ref={mapAreaRef}
        className={bg ? "vm-map-area vm-map-area-bg" : "vm-map-area"}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={() => mapAreaRef.current?.focus({ preventScroll: true })}
        aria-describedby="vm-summary"
      >
        {useGoogle ? (
          <GoogleEngine ref={engine} apiKey={googleMapsKey!} onFail={() => setGoogleFailed(true)} {...engineProps} />
        ) : (
          <CanvasEngine ref={engine} {...engineProps} />
        )}
      </div>

      <div className={bg ? "vm-overlay vm-overlay-bg" : "vm-overlay"}>
        {tipMarker && tipPos ? <Tooltip marker={tipMarker} x={tipPos.x} y={tipPos.y} size={tipPos.size} pinned={!!pinned} /> : null}

        {wheelHint ? (
          <div className="vm-hint" role="status">
            Click the map, then scroll to zoom (or {isMac ? "⌘" : "Ctrl"} + scroll)
          </div>
        ) : null}

        <div className="vm-controls-dock">
          {newVisit ? <NewVisitCard latest={newVisit.latest} fresh={newVisit.fresh} place={data?.places.find((p) => p.key === newVisit.latest.key)} /> : null}
          {settingsOpen ? <SettingsPanel settings={settings} onChange={updateSettings} onClose={() => setSettingsOpen(false)} hasGoogleKey={!!googleMapsKey} googleFailed={googleFailed} /> : null}
          <ControlsCard
            settings={settings}
            onChange={updateSettings}
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((c) => !c)}
            stats={stats}
            error={error}
            loaded={!!data}
            onZoomIn={() => zoom(BUTTON_ZOOM)}
            onZoomOut={() => zoom(1 / BUTTON_ZOOM)}
            onHome={home}
            onFullscreen={fullscreen}
            settingsOpen={settingsOpen}
            onToggleSettings={() => setSettingsOpen((o) => !o)}
          />
        </div>
      </div>

      <div id="vm-summary" className="sr-only">
        <h2>Top places</h2>
        {topPlaces.length ? (
          <ol>
            {topPlaces.map((p) => (
              <li key={p.key}>
                {placeLabel(p)}
                {p.country && p.city ? `, ${p.country}` : ""}: {p.visits} visits, {p.uniqueVisitors} unique visitors{p.online ? ", online now" : ""}, last seen {relativeTime(p.lastSeen)}
              </li>
            ))}
          </ol>
        ) : (
          <p>No visits in this range.</p>
        )}
      </div>
    </div>
  );
}

function Tooltip({ marker, x, y, size, pinned }: { marker: ScreenMarker; x: number; y: number; size: number; pinned: boolean }) {
  const lead = marker.members[0];
  const multi = marker.members.length > 1;
  const unique = marker.members.reduce((s, m) => s + m.uniqueVisitors, 0);
  const last = marker.members.reduce((a, m) => (m.lastSeen > a ? m.lastSeen : a), lead.lastSeen);
  const flipX = typeof window !== "undefined" && x > window.innerWidth - 300;
  return (
    <div
      className="vm-tooltip"
      role="tooltip"
      data-vm-tooltip=""
      style={{ left: x, top: y, transform: `translate(${flipX ? `calc(-100% - ${size / 2 + 12}px)` : `${size / 2 + 12}px`}, -50%)` }}
    >
      <div className="flex items-center gap-2">
        <Flag code={lead.countryCode} className="h-3.5 w-[21px] shrink-0" title={lead.country ?? undefined} />
        <p className="truncate font-semibold">{multi ? `${marker.members.length} places` : lead.label}</p>
      </div>
      {!multi && lead.kind === "place" ? <p className="vm-muted mt-0.5 truncate">{[lead.region, lead.country].filter(Boolean).join(", ")}</p> : null}
      {multi ? (
        <ul className="vm-muted mt-1 space-y-0.5">
          {marker.members.slice(0, 5).map((m) => (
            <li key={m.id} className="truncate">
              {m.label} · {m.visits}
            </li>
          ))}
          {marker.members.length > 5 ? <li>+{marker.members.length - 5} more</li> : null}
        </ul>
      ) : null}
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
        <dt className="vm-muted">Visits</dt>
        <dd>{marker.visits.toLocaleString()}</dd>
        <dt className="vm-muted">Unique visitors</dt>
        <dd>{unique.toLocaleString()}</dd>
        <dt className="vm-muted">Last seen</dt>
        <dd>{relativeTime(last)}</dd>
      </dl>
      {marker.online ? (
        <p className="vm-online mt-1.5">
          <span aria-hidden className="vm-dot" /> Online now
        </p>
      ) : null}
      <p className="vm-muted mt-1.5 text-[11px]">{multi ? "Click to zoom in" : pinned ? "Pinned · table filtered · Esc to clear" : "Click to pin and filter the table"}</p>
    </div>
  );
}

function NewVisitCard({ latest, fresh, place }: { latest: MapLatest; fresh: boolean; place?: VisitorMapData["places"][number] }) {
  const name = latest.city ?? place?.region ?? place?.country ?? latest.countryCode ?? "Unknown place";
  return (
    <div className="vm-newvisit" role="status" aria-live="polite" data-vm-new-visit="">
      <p className="vm-eyebrow">{fresh ? "New visit" : "Latest visit"}</p>
      <div className="mt-1 flex items-center gap-2.5">
        <Flag code={latest.countryCode} className="h-[18px] w-[27px] shrink-0" title={place?.country ?? latest.countryCode ?? undefined} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          <p className="vm-muted truncate text-xs">
            {[place?.city ? place.region : null, place?.country].filter(Boolean).join(", ") || latest.countryCode} · {relativeTime(latest.at)}
          </p>
        </div>
      </div>
    </div>
  );
}
