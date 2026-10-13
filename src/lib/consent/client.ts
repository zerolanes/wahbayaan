/**
 * Browser-side consent store and the `window.Consent` API.
 *
 *   Consent.get()                 → current choice (or null before a choice)
 *   Consent.has("statistics")     → boolean
 *   Consent.whenAllowed(g, fn)    → runs fn now or as soon as g is allowed (once); returns an unsubscribe
 *   Consent.onChange(fn)          → called on every change; returns an unsubscribe
 *   Consent.open()                → reopens the privacy settings
 *
 * Every change also dispatches `window.dispatchEvent(new CustomEvent("consent", { detail }))`.
 * Other scripts must load only through `whenAllowed`.
 */
import {
  ALL_ALLOWED,
  CONSENT_COOKIE,
  CONSENT_COOKIE_DAYS,
  ESSENTIAL_ONLY,
  isCurrent,
  newConsentId,
  parseConsent,
  readCookie,
  serializeConsent,
  type ConsentCategories,
  type ConsentDecision,
  type ConsentGroup,
  type ConsentState,
} from "./core";

export type ConsentApi = {
  get(): ConsentState | null;
  has(group: ConsentGroup): boolean;
  whenAllowed(group: ConsentGroup, fn: () => void): () => void;
  onChange(fn: (state: ConsentState | null) => void): () => void;
  open(): void;
};

declare global {
  interface Window {
    Consent?: ConsentApi;
  }
  interface WindowEventMap {
    consent: CustomEvent<ConsentState | null>;
  }
}

type Snapshot = { state: ConsentState | null; bot: boolean; ready: boolean };
let snapshot: Snapshot = { state: null, bot: false, ready: false };
const listeners = new Set<() => void>();
let opener: (() => void) | null = null;
let currentRev = 1;

export function getSnapshot(): Snapshot {
  return snapshot;
}
const SERVER_SNAPSHOT: Snapshot = { state: null, bot: false, ready: false };
export function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

function emit() {
  for (const l of [...listeners]) l();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("consent", { detail: snapshot.state }));
}

export function hasConsent(group: ConsentGroup): boolean {
  if (group === "essential") return true;
  return !!snapshot.state?.categories[group];
}

/** Read the cookie on start-up. A choice for an older consent version counts as no choice. */
export function initFromCookie(rev: number, bot: boolean) {
  currentRev = rev;
  if (bot) {
    // Bots: treated as "accepted" internally (embeds render) but never tracked and never written to a cookie.
    snapshot = { state: { v: 1, id: "bot", rev, ts: Date.now(), categories: ALL_ALLOWED }, bot: true, ready: true };
  } else {
    const parsed = parseConsent(readCookie(document.cookie, CONSENT_COOKIE));
    snapshot = { state: isCurrent(parsed, rev) ? parsed : null, bot: false, ready: true };
  }
  emit();
}

export function storedConsentId(): string | null {
  return parseConsent(readCookie(document.cookie, CONSENT_COOKIE))?.id ?? null;
}

export function saveConsent(state: ConsentState) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(state)}; Path=/; Max-Age=${CONSENT_COOKIE_DAYS * 86_400}; SameSite=Lax${secure}`;
  snapshot = { ...snapshot, state };
  emit();
}

export function clearConsent() {
  document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  snapshot = { ...snapshot, state: null };
  emit();
}

/** POST the decision as proof of consent (IP is shortened on the server). */
export function postProof(state: ConsentState, decision: ConsentDecision) {
  try {
    void fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ id: state.id, rev: state.rev, decision, categories: state.categories }),
    }).catch(() => {});
  } catch {
    /* offline: the cookie still holds the choice */
  }
}

/** Store a decision (cookie + proof). Keeps the visitor's existing consent id. */
export function commitChoice(categories: ConsentCategories, decision: ConsentDecision): ConsentState | null {
  if (snapshot.bot) return snapshot.state;
  const state: ConsentState = {
    v: 1,
    id: snapshot.state?.id ?? storedConsentId() ?? newConsentId(),
    rev: currentRev,
    ts: Date.now(),
    categories: { ...categories, essential: true },
  };
  saveConsent(state);
  postProof(state, decision);
  return state;
}

/** Withdraw everything: proof record, cookie removed (the banner asks again after the reload). */
export function revokeConsent() {
  if (snapshot.bot) return;
  const id = snapshot.state?.id ?? storedConsentId();
  if (id) postProof({ v: 1, id, rev: currentRev, ts: Date.now(), categories: ESSENTIAL_ONLY }, "revoke");
  clearConsent();
}

/** Grant one more group on top of the current choice (e.g. "Always allow media"). */
export function grantGroup(group: ConsentGroup) {
  const base = snapshot.state?.categories ?? ESSENTIAL_ONLY;
  commitChoice({ ...base, [group]: true }, "custom");
}

export function setOpener(fn: (() => void) | null) {
  opener = fn;
}

export function installWindowApi() {
  const api: ConsentApi = {
    get: () => snapshot.state,
    has: hasConsent,
    whenAllowed(group, fn) {
      if (hasConsent(group)) {
        fn();
        return () => {};
      }
      const off = subscribe(() => {
        if (hasConsent(group)) {
          off();
          fn();
        }
      });
      return off;
    },
    onChange(fn) {
      return subscribe(() => fn(snapshot.state));
    },
    open() {
      opener?.();
    },
  };
  window.Consent = api;
  return api;
}
