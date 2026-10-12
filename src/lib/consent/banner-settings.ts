/**
 * Look and texts of the cookie banner (`consent_banner` setting). Every colour,
 * size and padding becomes a `--consent-*` CSS variable, so Admin → Cookie
 * banner can change the look with a live preview. Defaults: the owner's spec
 * sizes (5px radius, 50px buttons, 18px button text) in Wahbayaan's palette
 * and type. Client-safe (no server imports).
 */

export const BANNER_LAYOUTS = ["bar", "dialog", "corner", "top", "bar-dark", "dialog-dark"] as const;
export type BannerLayout = (typeof BANNER_LAYOUTS)[number];
export const LAYOUT_LABELS: Record<BannerLayout, string> = {
  bar: "Bottom bar",
  dialog: "Centred dialog",
  corner: "Compact corner box",
  top: "Top bar",
  "bar-dark": "Bottom bar (dark)",
  "dialog-dark": "Centred dialog (dark)",
};

export type BannerPalette = {
  background: string;
  text: string;
  muted: string;
  border: string;
  footerBackground: string;
  buttonBackground: string;
  buttonText: string;
  link: string;
  focus: string;
  switchOn: string;
  boxBackground: string;
};

export type BannerTexts = {
  title: string;
  description: string;
  acceptAll: string;
  continueWithout: string;
  individual: string;
  save: string;
  back: string;
  privacyLabel: string;
  privacyUrl: string;
  alwaysActive: string;
  showServices: string;
  hideServices: string;
};

export type BannerSizes = {
  maxWidth: number;
  buttonColumn: number;
  radius: number;
  panelRadius: number;
  buttonMinHeight: number;
  buttonFontSize: number;
  buttonPadding: number;
  gap: number;
  padding: number;
  textSize: number;
  smallSize: number;
  headlineSize: number;
  logoHeight: number;
  maxHeight: number;
};

export type ConsentBannerSetting = {
  layout: BannerLayout;
  floatingButton: boolean;
  texts: BannerTexts;
  light: BannerPalette;
  dark: BannerPalette;
  sizes: BannerSizes;
};

export const DEFAULT_CONSENT_BANNER: ConsentBannerSetting = {
  layout: "bar",
  floatingButton: false,
  texts: {
    title: "Privacy preferences",
    description:
      "We use cookies and similar technologies. Some are essential to run the shop; others help us understand how the site is used or play videos from other services. You decide which ones we may use, and you can change your choice at any time.",
    acceptAll: "Accept all",
    continueWithout: "Continue without consent",
    individual: "Set privacy settings individually",
    save: "Save custom choices",
    back: "Back",
    privacyLabel: "Privacy policy",
    privacyUrl: "/privacy",
    alwaysActive: "Always active",
    showServices: "Show service information",
    hideServices: "Hide service information",
  },
  // Wahbayaan: sand-50 surface, umber text, indigo-900 buttons, terracotta links.
  light: {
    background: "#fdfbf7",
    text: "#221a13",
    muted: "#5e4f3e",
    border: "#e9e1d8",
    footerBackground: "#f6f0e6",
    buttonBackground: "#171f3d",
    buttonText: "#fdfbf7",
    link: "#8a3f25",
    focus: "#34498a",
    switchOn: "#171f3d",
    boxBackground: "#ffffff",
  },
  // `.night`: deep indigo surface, sand text, gold buttons.
  dark: {
    background: "#0d1124",
    text: "#f6f0e6",
    muted: "#c8d1ea",
    border: "#283a70",
    footerBackground: "#141a33",
    buttonBackground: "#e0bf73",
    buttonText: "#15192e",
    link: "#ecd7a4",
    focus: "#ecd7a4",
    switchOn: "#d0a652",
    boxBackground: "#171f3d",
  },
  sizes: {
    maxWidth: 1024,
    buttonColumn: 320,
    radius: 5,
    panelRadius: 5,
    buttonMinHeight: 50,
    buttonFontSize: 18,
    buttonPadding: 10,
    gap: 10,
    padding: 20,
    textSize: 16,
    smallSize: 12,
    headlineSize: 20,
    logoHeight: 53,
    maxHeight: 500,
  },
};

export const isDarkLayout = (layout: BannerLayout) => layout === "bar-dark" || layout === "dialog-dark";
export const isDialogLayout = (layout: BannerLayout) => layout === "dialog" || layout === "dialog-dark";

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i;

/** Merge a stored (possibly partial or outdated) value onto the defaults, dropping invalid entries. */
export function normalizeBanner(stored: unknown): ConsentBannerSetting {
  const d = DEFAULT_CONSENT_BANNER;
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<Record<keyof ConsentBannerSetting, unknown>>;
  const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
  const palette = (v: unknown, def: BannerPalette): BannerPalette => {
    const o = obj(v);
    const out = { ...def };
    for (const k of Object.keys(def) as (keyof BannerPalette)[]) if (typeof o[k] === "string" && HEX.test(o[k] as string)) out[k] = o[k] as string;
    return out;
  };
  const texts = obj(s.texts);
  const outTexts = { ...d.texts };
  for (const k of Object.keys(d.texts) as (keyof BannerTexts)[]) {
    const v = texts[k];
    if (typeof v === "string" && v.trim()) outTexts[k] = v.slice(0, k === "description" ? 2000 : 200);
  }
  // Only same-site paths or http(s) links for the policy link.
  if (!/^(\/(?!\/)|https?:\/\/)/.test(outTexts.privacyUrl)) outTexts.privacyUrl = d.texts.privacyUrl;
  const sizes = obj(s.sizes);
  const outSizes = { ...d.sizes };
  for (const k of Object.keys(d.sizes) as (keyof BannerSizes)[]) {
    const v = Number(sizes[k]);
    if (Number.isFinite(v) && v >= 0 && v <= 2000) outSizes[k] = Math.round(v);
  }
  return {
    layout: (BANNER_LAYOUTS as readonly string[]).includes(s.layout as string) ? (s.layout as BannerLayout) : d.layout,
    floatingButton: s.floatingButton === true,
    texts: outTexts,
    light: palette(s.light, d.light),
    dark: palette(s.dark, d.dark),
    sizes: outSizes,
  };
}

/** The `--consent-*` variables for one banner instance. */
export function bannerCssVars(b: ConsentBannerSetting): Record<string, string> {
  const p = isDarkLayout(b.layout) ? b.dark : b.light;
  const z = b.sizes;
  return {
    "--consent-bg": p.background,
    "--consent-text": p.text,
    "--consent-muted": p.muted,
    "--consent-border": p.border,
    "--consent-footer-bg": p.footerBackground,
    "--consent-button-bg": p.buttonBackground,
    "--consent-button-text": p.buttonText,
    "--consent-link": p.link,
    "--consent-focus": p.focus,
    "--consent-switch-on": p.switchOn,
    "--consent-box-bg": p.boxBackground,
    "--consent-max-width": `${z.maxWidth}px`,
    "--consent-button-column": `${z.buttonColumn}px`,
    "--consent-radius": `${z.radius}px`,
    "--consent-panel-radius": `${z.panelRadius}px`,
    "--consent-button-min-height": `${z.buttonMinHeight}px`,
    "--consent-button-font-size": `${z.buttonFontSize}px`,
    "--consent-button-padding": `${z.buttonPadding}px`,
    "--consent-gap": `${z.gap}px`,
    "--consent-padding": `${z.padding}px`,
    "--consent-text-size": `${z.textSize}px`,
    "--consent-small-size": `${z.smallSize}px`,
    "--consent-headline-size": `${z.headlineSize}px`,
    "--consent-logo-height": `${z.logoHeight}px`,
    "--consent-max-height": `${z.maxHeight}px`,
  };
}
