/**
 * Cookie consent: the shared, dependency-free core used by the banner (client),
 * the ingest routes (server) and the tests.
 *
 * The visitor's choice lives in the first-party `wb_consent` cookie for 365 days:
 *   { v, id, rev, ts, categories }
 * `rev` is the consent version set in Admin → Privacy settings; raising it
 * makes every stored choice stale so the banner asks again.
 */

export const CONSENT_COOKIE = "wb_consent";
/** 30-minute visit id, set by the ingest route only after Statistics consent. */
export const VISIT_COOKIE = "wb_visit";
export const CONSENT_COOKIE_DAYS = 365;
export const VISIT_MINUTES = 30;
export const CONSENT_FORMAT_VERSION = 1;

export const CONSENT_GROUPS = ["essential", "statistics", "functional", "marketing"] as const;
export type ConsentGroup = (typeof CONSENT_GROUPS)[number];
export type ConsentCategories = Record<ConsentGroup, boolean>;
export type ConsentDecision = "accept_all" | "essentials" | "custom" | "revoke";
export const CONSENT_DECISIONS: readonly ConsentDecision[] = ["accept_all", "essentials", "custom", "revoke"];

export type ConsentState = {
  v: number;
  /** Random consent id, shown to the visitor and stored with every record. */
  id: string;
  rev: number;
  /** Unix ms when the choice was made. */
  ts: number;
  categories: ConsentCategories;
};

export const ESSENTIAL_ONLY: ConsentCategories = { essential: true, statistics: false, functional: false, marketing: false };
export const ALL_ALLOWED: ConsentCategories = { essential: true, statistics: true, functional: true, marketing: true };

// ── Cookie value ────────────────────────────────────────────────────────────

export function serializeConsent(state: ConsentState): string {
  const c = state.categories;
  return encodeURIComponent(
    JSON.stringify({
      v: CONSENT_FORMAT_VERSION,
      id: state.id,
      rev: state.rev,
      ts: state.ts,
      categories: { essential: true, statistics: !!c.statistics, functional: !!c.functional, marketing: !!c.marketing },
    }),
  );
}

/** Parse a raw cookie value. Anything malformed is treated as "no choice yet". */
export function parseConsent(raw: string | null | undefined): ConsentState | null {
  if (!raw) return null;
  try {
    let text = raw;
    try {
      text = decodeURIComponent(raw);
    } catch {
      /* already decoded */
    }
    const o = JSON.parse(text) as Partial<ConsentState> & { categories?: Partial<ConsentCategories> };
    if (!o || typeof o !== "object") return null;
    if (o.v !== CONSENT_FORMAT_VERSION) return null;
    if (typeof o.id !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(o.id)) return null;
    if (typeof o.rev !== "number" || !Number.isInteger(o.rev) || o.rev < 1) return null;
    if (typeof o.ts !== "number" || !Number.isFinite(o.ts)) return null;
    const c: Partial<ConsentCategories> = o.categories ?? {};
    return {
      v: CONSENT_FORMAT_VERSION,
      id: o.id,
      rev: o.rev,
      ts: o.ts,
      categories: { essential: true, statistics: c.statistics === true, functional: c.functional === true, marketing: c.marketing === true },
    };
  } catch {
    return null;
  }
}

/** Read one cookie out of a `Cookie:` header / `document.cookie` string. */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** A stored choice counts only when it was made for the current consent version. */
export function isCurrent(state: ConsentState | null, currentRev: number): state is ConsentState {
  return !!state && state.rev === currentRev;
}

/**
 * Server-side gate for the statistics beacon: the cookie must parse, carry the
 * current consent version and allow Statistics. Returns the consent id or null.
 */
export function statisticsConsentId(rawCookie: string | null | undefined, currentRev: number): string | null {
  const state = parseConsent(rawCookie);
  if (!isCurrent(state, currentRev)) return null;
  return state.categories.statistics ? state.id : null;
}

export function newConsentId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

export function decisionFor(categories: ConsentCategories): ConsentDecision {
  if (categories.statistics && categories.functional && categories.marketing) return "accept_all";
  if (!categories.statistics && !categories.functional && !categories.marketing) return "essentials";
  return "custom";
}

// ── Bots ────────────────────────────────────────────────────────────────────

/** Crawlers, previewers, headless browsers and audit tools never see the banner and are never tracked. */
export const BOT_UA =
  /bot\b|bot[/;_-]|crawl|spider|slurp|scrap|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|skype|bingpreview|mediapartners|adsbot|feedfetcher|python-requests|python-urllib|curl\/|wget|httpclient|okhttp|go-http-client|java\/|axios|node-fetch|undici|phantomjs|puppeteer|playwright|selenium|chrome-lighthouse|gtmetrix|pingdom|uptime|monitor|validator|archive\.org|ia_archiver/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.trim().length < 8) return true;
  return BOT_UA.test(ua);
}

// ── Paths ───────────────────────────────────────────────────────────────────

/** Dashboards and API calls are never counted. */
export function isTrackablePath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  return !/^\/(admin|seller|api|_next|lab)(\/|$)/.test(path);
}

export const PRIVACY_POLICY_PATH = "/privacy";
