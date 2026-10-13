"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Expand, House, Minus, Plus, Settings2, X } from "lucide-react";
import { DEFAULT_SETTINGS, RANGES } from "./settings";
import type { CrossColour, MapMode, VisitorMapSettings } from "./types";

type Change = (patch: Partial<VisitorMapSettings>) => void;

const MODES: { value: MapMode; label: string }[] = [
  { value: "places", label: "Places" },
  { value: "countries", label: "Countries" },
  { value: "top10", label: "Top 10" },
];

function Chips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange(v: T): void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="vm-chips">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className="vm-chip"
          onClick={() => onChange(o.value)}
          data-value={o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ label, checked, onChange, name }: { label: string; checked: boolean; onChange(v: boolean): void; name: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="vm-switch" onClick={() => onChange(!checked)} data-switch={name}>
      <span className="vm-switch-track" aria-hidden>
        <span className="vm-switch-thumb" />
      </span>
      {label}
    </button>
  );
}

function IconButton({ label, onClick, children, pressed, name }: { label: string; onClick(): void; children: ReactNode; pressed?: boolean; name: string }) {
  return (
    <button type="button" className="vm-icon-btn" aria-label={label} title={label} onClick={onClick} aria-pressed={pressed} data-control={name}>
      {children}
    </button>
  );
}

export function ControlsCard(props: {
  settings: VisitorMapSettings;
  onChange: Change;
  collapsed: boolean;
  onToggleCollapsed(): void;
  stats: { places: number; visits: number; online: number };
  error: string | null;
  loaded: boolean;
  onZoomIn(): void;
  onZoomOut(): void;
  onHome(): void;
  onFullscreen(): void;
  settingsOpen: boolean;
  onToggleSettings(): void;
}) {
  const { settings: s, onChange, collapsed, stats } = props;
  const bodyId = useId();
  return (
    <section className="vm-card vm-controls" aria-label="Visitor map controls" data-collapsed={collapsed ? "1" : "0"}>
      <header className="flex items-center gap-2">
        <h2 className="vm-title">Visitor map</h2>
        {stats.online ? (
          <span className="vm-online text-xs" title={`${stats.online} places with a visitor online now`}>
            <span aria-hidden className="vm-dot" /> {stats.online} online
          </span>
        ) : null}
        <button
          type="button"
          className="vm-icon-btn ml-auto"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          aria-label={collapsed ? "Expand map controls" : "Collapse map controls"}
          onClick={props.onToggleCollapsed}
          data-control="collapse"
        >
          {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </header>
      {collapsed ? null : (
        <div id={bodyId} className="mt-2 space-y-2.5">
          <p className="vm-muted text-xs tabular-nums" aria-live="polite">
            {props.error
              ? props.error
              : props.loaded
                ? `${stats.places.toLocaleString()} places · ${stats.visits.toLocaleString()} visits`
                : "Loading visitors…"}
            {s.everyPlace ? " · every place ever" : ""}
          </p>
          <Chips label="Time range" value={s.everyPlace ? "all" : s.range} options={RANGES} onChange={(range) => onChange({ range, everyPlace: false })} />
          <Chips label="Show" value={s.mode} options={MODES} onChange={(mode) => onChange({ mode })} />
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            <Switch name="live" label="Live only" checked={s.liveOnly} onChange={(liveOnly) => onChange({ liveOnly })} />
            <Switch name="labels" label="Labels" checked={s.labels} onChange={(labels) => onChange({ labels })} />
            <Switch name="autofly" label="Auto-fly" checked={s.autoFly} onChange={(autoFly) => onChange({ autoFly })} />
          </div>
          <details className="vm-more">
            <summary>More</summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <IconButton name="zoom-out" label="Zoom out" onClick={props.onZoomOut}>
                <Minus className="size-4" />
              </IconButton>
              <IconButton name="zoom-in" label="Zoom in" onClick={props.onZoomIn}>
                <Plus className="size-4" />
              </IconButton>
              <IconButton name="home" label="Whole world" onClick={props.onHome}>
                <House className="size-4" />
              </IconButton>
              <IconButton name="fullscreen" label="Full screen" onClick={props.onFullscreen}>
                <Expand className="size-4" />
              </IconButton>
              <IconButton name="settings" label="Map settings" onClick={props.onToggleSettings} pressed={props.settingsOpen}>
                <Settings2 className="size-4" />
              </IconButton>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="vm-label">{label}</span>
      {children}
      {hint ? <span className="vm-muted block text-[11px]">{hint}</span> : null}
    </label>
  );
}

const COLOURS: { value: CrossColour; label: string; swatch: string }[] = [
  { value: "auto", label: "Automatic", swatch: "conic-gradient(#e0bf73 0 50%, #a9502e 0)" },
  { value: "gold", label: "Gold", swatch: "#d0a652" },
  { value: "terracotta", label: "Terracotta", swatch: "#c4623a" },
  { value: "sand", label: "Sand", swatch: "#dccbac" },
  { value: "ivory", label: "Ivory", swatch: "#fdfbf7" },
];

export function SettingsPanel({
  settings: s,
  onChange,
  onClose,
  hasGoogleKey,
  googleFailed,
}: {
  settings: VisitorMapSettings;
  onChange: Change;
  onClose(): void;
  hasGoogleKey: boolean;
  googleFailed: boolean;
}) {
  return (
    <section className="vm-card vm-settings" role="dialog" aria-label="Map settings" data-vm-settings="">
      <header className="mb-2 flex items-center">
        <h2 className="vm-title">Map settings</h2>
        <button type="button" className="vm-icon-btn ml-auto" aria-label="Close settings" onClick={onClose}>
          <X className="size-4" />
        </button>
      </header>
      <div className="vm-settings-body space-y-3">
        <div className="space-y-1">
          <span className="vm-label">Map style</span>
          <Chips
            label="Map style"
            value={s.style}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={(style) => onChange({ style })}
          />
        </div>
        <Row
          label="Map engine"
          hint={
            hasGoogleKey ? (
              googleFailed ? (
                "Google Maps didn't load — using the built-in map."
              ) : (
                "A Google Maps key is saved in Admin → Settings."
              )
            ) : (
              <>
                No Google Maps key saved — add one in{" "}
                <a className="underline" href="/admin/settings#visitor-map">
                  Admin → Settings
                </a>
                .
              </>
            )
          }
        >
          <select className="vm-select" value={s.engine} onChange={(e) => onChange({ engine: e.target.value as VisitorMapSettings["engine"] })}>
            <option value="auto">Google Maps when a key is saved</option>
            <option value="builtin">Built-in map</option>
          </select>
        </Row>
        <Row label="Projection">
          <select
            className="vm-select"
            value={s.projection}
            onChange={(e) => onChange({ projection: e.target.value as VisitorMapSettings["projection"] })}
            data-setting="projection"
          >
            <option value="naturalEarth">Natural Earth</option>
            <option value="equirectangular">Equirectangular</option>
            <option value="mercator">Mercator</option>
          </select>
        </Row>
        <div className="grid grid-cols-2 gap-3">
          <Row label="Cross style">
            <select className="vm-select" value={s.crossStyle} onChange={(e) => onChange({ crossStyle: e.target.value as VisitorMapSettings["crossStyle"] })}>
              <option value="brush">Ink brush</option>
              <option value="fine">Fine</option>
              <option value="bold">Bold</option>
            </select>
          </Row>
          <Row label={`Cross size · ${s.crossSize.toFixed(2)}×`}>
            <input
              type="range"
              className="vm-range"
              min={0.75}
              max={1.75}
              step={0.05}
              value={s.crossSize}
              onChange={(e) => onChange({ crossSize: Number(e.target.value) })}
            />
          </Row>
        </div>
        <div className="space-y-1">
          <span className="vm-label">Cross colour</span>
          <div role="radiogroup" aria-label="Cross colour" className="flex gap-2">
            {COLOURS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={s.crossColour === c.value}
                aria-label={c.label}
                title={c.label}
                className="vm-swatch"
                style={{ background: c.swatch }}
                onClick={() => onChange({ crossColour: c.value })}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Row label={`Animation speed · ${s.animationSpeed.toFixed(2)}×`}>
            <input
              type="range"
              className="vm-range"
              min={0.5}
              max={2}
              step={0.25}
              value={s.animationSpeed}
              onChange={(e) => onChange({ animationSpeed: Number(e.target.value) })}
            />
          </Row>
          <Row label={`Fly zoom · level ${s.flyZoom}`}>
            <input
              type="range"
              className="vm-range"
              min={2}
              max={9}
              step={1}
              value={s.flyZoom}
              onChange={(e) => onChange({ flyZoom: Number(e.target.value) })}
            />
          </Row>
          <Row label="Fly hold time">
            <select className="vm-select" value={s.flyHoldSeconds} onChange={(e) => onChange({ flyHoldSeconds: Number(e.target.value) })}>
              {[2, 3, 5, 8, 10, 15, 30].map((n) => (
                <option key={n} value={n}>
                  {n} s
                </option>
              ))}
            </select>
          </Row>
          <Row label="Check for visits every">
            <select className="vm-select" value={s.pollSeconds} onChange={(e) => onChange({ pollSeconds: Number(e.target.value) })}>
              {[10, 20, 30, 60, 120].map((n) => (
                <option key={n} value={n}>
                  {n} s
                </option>
              ))}
            </select>
          </Row>
          <Row label="Max markers">
            <select className="vm-select" value={s.maxMarkers} onChange={(e) => onChange({ maxMarkers: Number(e.target.value) })}>
              {[100, 250, 500, 1000, 2500, 5000].map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString()}
                </option>
              ))}
            </select>
          </Row>
        </div>
        <div className="flex flex-col gap-1.5">
          <Switch name="hide-dc" label="Hide data-centre traffic" checked={s.hideDatacenter} onChange={(hideDatacenter) => onChange({ hideDatacenter })} />
          <Switch name="every-place" label="Every place ever" checked={s.everyPlace} onChange={(everyPlace) => onChange({ everyPlace })} />
        </div>
        <button
          type="button"
          className="vm-link text-xs"
          onClick={() => {
            const { range, mode, liveOnly, labels, autoFly } = s;
            onChange({ ...DEFAULT_SETTINGS, range, mode, liveOnly, labels, autoFly });
          }}
        >
          Reset map settings
        </button>
      </div>
    </section>
  );
}
