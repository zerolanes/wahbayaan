"use client";

import { useEffect, useRef, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { ConsentBanner, type BannerView } from "@/components/consent/consent-banner";
import type { AdminAction } from "@/lib/admin/action-state";
import {
  BANNER_LAYOUTS,
  DEFAULT_CONSENT_BANNER,
  LAYOUT_LABELS,
  isDarkLayout,
  type BannerPalette,
  type BannerSizes,
  type BannerTexts,
  type ConsentBannerSetting,
} from "@/lib/consent/banner-settings";
import { ESSENTIAL_ONLY, type ConsentCategories } from "@/lib/consent/core";
import { cn } from "@/lib/utils/cn";

const DEVICES = [
  { key: "phone", label: "Phone 390", width: 390, height: 760 },
  { key: "tablet", label: "Tablet 768", width: 768, height: 820 },
  { key: "desktop", label: "Desktop 1280", width: 1280, height: 760 },
] as const;

const TEXT_FIELDS: { key: keyof BannerTexts; label: string; long?: boolean }[] = [
  { key: "title", label: "Headline" },
  { key: "description", label: "Description", long: true },
  { key: "acceptAll", label: "“Accept all” button" },
  { key: "continueWithout", label: "“Continue without consent” button" },
  { key: "individual", label: "Individual settings link" },
  { key: "save", label: "Save button (individual view)" },
  { key: "back", label: "Back link" },
  { key: "alwaysActive", label: "“Always active” label" },
  { key: "showServices", label: "Show service information" },
  { key: "hideServices", label: "Hide service information" },
  { key: "privacyLabel", label: "Privacy policy link text" },
  { key: "privacyUrl", label: "Privacy policy link (path or https URL)" },
];

const COLOR_FIELDS: { key: keyof BannerPalette; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Secondary text" },
  { key: "border", label: "Borders" },
  { key: "footerBackground", label: "Footer strip" },
  { key: "buttonBackground", label: "Buttons" },
  { key: "buttonText", label: "Button text" },
  { key: "link", label: "Links" },
  { key: "focus", label: "Focus outline" },
  { key: "switchOn", label: "Switch (on)" },
  { key: "boxBackground", label: "Group boxes" },
];

const SIZE_FIELDS: { key: keyof BannerSizes; label: string }[] = [
  { key: "maxWidth", label: "Content max width" },
  { key: "buttonColumn", label: "Button column (desktop)" },
  { key: "radius", label: "Button & box radius" },
  { key: "panelRadius", label: "Dialog / corner radius" },
  { key: "buttonMinHeight", label: "Button min height" },
  { key: "buttonFontSize", label: "Button text size" },
  { key: "buttonPadding", label: "Button padding" },
  { key: "gap", label: "Button gap" },
  { key: "padding", label: "Panel padding" },
  { key: "textSize", label: "Description text" },
  { key: "smallSize", label: "Small text" },
  { key: "headlineSize", label: "Headline size" },
  { key: "logoHeight", label: "Logo max height" },
  { key: "maxHeight", label: "Panel max height" },
];

/** Cookie banner editor: every look and text field with a live preview at phone / tablet / desktop width. */
export function BannerEditor({ initial, saveAction, resetAction, retentionDays }: { initial: ConsentBannerSetting; saveAction: AdminAction; resetAction: AdminAction; retentionDays: number }) {
  const [b, setB] = useState<ConsentBannerSetting>(initial);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["key"]>("desktop");
  const [view, setView] = useState<BannerView>("main");
  const [draft, setDraft] = useState<ConsentCategories>(ESSENTIAL_ONLY);
  const [paletteTab, setPaletteTab] = useState<"light" | "dark">(isDarkLayout(initial.layout) ? "dark" : "light");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const dev = DEVICES.find((d) => d.key === device)!;

  useEffect(() => setB(initial), [initial]);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / dev.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [dev.width]);

  const setText = (k: keyof BannerTexts, v: string) => setB((x) => ({ ...x, texts: { ...x.texts, [k]: v } }));
  const setColor = (k: keyof BannerPalette, v: string) => setB((x) => ({ ...x, [paletteTab]: { ...x[paletteTab], [k]: v } }));
  const setSize = (k: keyof BannerSizes, v: number) => setB((x) => ({ ...x, sizes: { ...x.sizes, [k]: v } }));
  const dirty = JSON.stringify(b) !== JSON.stringify(initial);
  const chip = (on: boolean) => cn("rounded-lg border px-3 py-1.5 text-sm", on ? "border-umber-900 bg-umber-900 text-white" : "border-umber-200 bg-white text-umber-700 hover:border-umber-400");

  return (
    <div className="grid items-start gap-6 2xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <ActionForm action={saveAction} className="space-y-5">
          <input type="hidden" name="banner" value={JSON.stringify(b)} />
          <fieldset className="space-y-3 rounded-xl border border-umber-200 bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-umber-900">Layout</legend>
            <FieldRow label="Preset">
              <SelectInput
                value={b.layout}
                onChange={(e) => {
                  const layout = e.target.value as ConsentBannerSetting["layout"];
                  setB((x) => ({ ...x, layout }));
                  setPaletteTab(isDarkLayout(layout) ? "dark" : "light");
                }}
              >
                {BANNER_LAYOUTS.map((l) => (
                  <option key={l} value={l}>
                    {LAYOUT_LABELS[l]}
                  </option>
                ))}
              </SelectInput>
            </FieldRow>
            <Toggle checked={b.floatingButton} onChange={(e) => setB((x) => ({ ...x, floatingButton: e.target.checked }))} label="Floating privacy button after a choice" />
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-umber-200 bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-umber-900">Texts</legend>
            {TEXT_FIELDS.map((f) => (
              <FieldRow key={f.key} label={f.label}>
                {f.long ? (
                  <TextArea rows={5} value={b.texts[f.key]} maxLength={2000} onChange={(e) => setText(f.key, e.target.value)} />
                ) : (
                  <TextInput value={b.texts[f.key]} maxLength={200} onChange={(e) => setText(f.key, e.target.value)} />
                )}
              </FieldRow>
            ))}
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-umber-200 bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-umber-900">Colours</legend>
            <div className="flex gap-1.5" role="group" aria-label="Palette">
              <button type="button" className={chip(paletteTab === "light")} onClick={() => setPaletteTab("light")} aria-pressed={paletteTab === "light"}>
                Light presets
              </button>
              <button type="button" className={chip(paletteTab === "dark")} onClick={() => setPaletteTab("dark")} aria-pressed={paletteTab === "dark"}>
                Dark presets
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {COLOR_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-xs text-umber-700">
                  <input type="color" value={b[paletteTab][f.key].slice(0, 7)} onChange={(e) => setColor(f.key, e.target.value)} className="h-8 w-10 shrink-0 cursor-pointer rounded border border-umber-200 bg-white p-0.5" aria-label={`${f.label} colour`} />
                  <span className="min-w-0">
                    <span className="block font-medium">{f.label}</span>
                    <span className="font-mono text-[11px] text-umber-500">{b[paletteTab][f.key]}</span>
                  </span>
                </label>
              ))}
            </div>
            {paletteTab === "dark" && !isDarkLayout(b.layout) ? <p className="text-xs text-umber-500">Used by the dark bar and dark dialog presets.</p> : null}
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-umber-200 bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-umber-900">Sizes (px)</legend>
            <div className="grid grid-cols-2 gap-3">
              {SIZE_FIELDS.map((f) => (
                <FieldRow key={f.key} label={f.label}>
                  <TextInput type="number" min={0} max={2000} value={b.sizes[f.key]} onChange={(e) => setSize(f.key, Number(e.target.value))} />
                </FieldRow>
              ))}
            </div>
          </fieldset>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-umber-200 bg-white/95 p-3 backdrop-blur">
            <SubmitButton disabled={!dirty}>Save banner</SubmitButton>
            <button type="button" className="h-9 rounded-lg px-3 text-sm text-umber-600 hover:bg-umber-100" onClick={() => setB(initial)} disabled={!dirty}>
              Discard changes
            </button>
            <button type="button" className="h-9 rounded-lg px-3 text-sm text-umber-600 hover:bg-umber-100" onClick={() => setB({ ...DEFAULT_CONSENT_BANNER, layout: b.layout, floatingButton: b.floatingButton })}>
              Load defaults
            </button>
            {dirty ? <span className="text-xs text-pending-600">Unsaved changes</span> : null}
          </div>
        </ActionForm>
        <ActionForm action={resetAction} confirm="Reset the banner's look and texts to the defaults?">
          <SubmitButton variant="ghost">Reset saved banner to defaults</SubmitButton>
        </ActionForm>
      </div>

      <div className="order-first min-w-0 space-y-3 2xl:sticky 2xl:top-20 2xl:order-last">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Preview width">
            {DEVICES.map((d) => (
              <button key={d.key} type="button" className={chip(device === d.key)} aria-pressed={device === d.key} onClick={() => setDevice(d.key)}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Preview view">
            <button type="button" className={chip(view === "main")} aria-pressed={view === "main"} onClick={() => setView("main")}>
              Banner
            </button>
            <button type="button" className={chip(view === "settings")} aria-pressed={view === "settings"} onClick={() => setView("settings")}>
              Individual settings
            </button>
          </div>
        </div>
        <div ref={wrapRef} className="w-full overflow-hidden rounded-xl border border-umber-200 bg-white" style={{ height: dev.height * scale }} data-banner-preview="">
          <div style={{ width: dev.width, height: dev.height, transform: `scale(${scale})`, transformOrigin: "top left" }} className="relative overflow-hidden">
            <FakePage />
            <ConsentBanner
              preview
              previewVh={dev.height / 100}
              settings={b}
              view={view}
              onView={setView}
              draft={draft}
              onDraft={(g, on) => setDraft((d) => ({ ...d, [g]: on }))}
              onAcceptAll={() => {}}
              onContinue={() => {}}
              onSave={() => {}}
              retentionDays={retentionDays}
            />
          </div>
        </div>
        <p className="text-xs text-umber-500">Live preview — changes show at once; visitors see them after you save. The preview is inert (buttons do nothing).</p>
      </div>
    </div>
  );
}

/** A stand-in storefront behind the preview. */
function FakePage() {
  return (
    <div aria-hidden className="absolute inset-0" style={{ background: "#f6f1e8" }}>
      <div className="mx-4 mt-4 flex h-14 items-center justify-between rounded-full px-5" style={{ background: "#fdfbf7", boxShadow: "0 8px 28px -10px rgb(34 26 19 / 0.22)" }}>
        <span className="h-3 w-16 rounded-full" style={{ background: "#d2c3b3" }} />
        <span className="h-4 w-28 rounded-full" style={{ background: "#a9502e" }} />
        <span className="h-3 w-16 rounded-full" style={{ background: "#d2c3b3" }} />
      </div>
      <div className="mx-auto mt-16 flex max-w-xl flex-col items-center gap-4 px-6">
        <span className="h-10 w-3/4 rounded-xl" style={{ background: "#e0bf73" }} />
        <span className="h-4 w-1/2 rounded-full" style={{ background: "#d2c3b3" }} />
        <span className="mt-2 h-11 w-36 rounded-full" style={{ background: "#171f3d" }} />
      </div>
      <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 px-6 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="aspect-[4/5] rounded-[22px]" style={{ background: i % 2 ? "#ece2d1" : "#dccbac" }} />
        ))}
      </div>
    </div>
  );
}
