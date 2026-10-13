"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Fingerprint } from "lucide-react";
import { bannerCssVars, type ConsentBannerSetting } from "@/lib/consent/banner-settings";
import { ALL_ALLOWED, ESSENTIAL_ONLY, PRIVACY_POLICY_PATH, isBotUserAgent, isTrackablePath, type ConsentCategories, type ConsentGroup } from "@/lib/consent/core";
import {
  commitChoice,
  getServerSnapshot,
  getSnapshot,
  initFromCookie,
  installWindowApi,
  revokeConsent,
  setOpener,
  subscribe,
} from "@/lib/consent/client";
import { ConsentBanner, type BannerView } from "./consent-banner";

/** Subscribe a component to the visitor's consent (null until a choice is made). */
export function useConsent() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Cookie banner + `window.Consent` + the statistics beacon. Mounted once by
 * the storefront layout (`ConsentRoot`), which already decided on the server
 * whether to render the banner (no choice for the current version, not a bot,
 * not the privacy policy page) so it appears with the first paint.
 */
export function ConsentManager({
  settings,
  rev,
  retentionDays,
  bot: botFromServer,
  initiallyOpen,
}: {
  settings: ConsentBannerSetting;
  rev: number;
  retentionDays: number;
  bot: boolean;
  initiallyOpen: boolean;
}) {
  const pathname = usePathname();
  const snap = useConsent();
  const [open, setOpen] = useState(initiallyOpen);
  const [view, setView] = useState<BannerView>("main");
  const [draft, setDraft] = useState<ConsentCategories>(ESSENTIAL_ONLY);
  const returnFocus = useRef<HTMLElement | null>(null);
  const isBot = botFromServer || snap.bot;

  const openSettings = useCallback(() => {
    if (getSnapshot().bot) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDraft(getSnapshot().state?.categories ?? ESSENTIAL_ONLY);
    setView("settings");
    setOpen(true);
  }, []);

  // Start-up: read the cookie, install window.Consent, decide on the banner.
  useEffect(() => {
    const bot = botFromServer || isBotUserAgent(navigator.userAgent);
    installWindowApi();
    setOpener(openSettings);
    initFromCookie(rev, bot);
    const s = getSnapshot();
    if (bot) setOpen(false);
    else if (!s.state && location.pathname !== PRIVACY_POLICY_PATH) setOpen(true);
    else if (s.state && initiallyOpen) setOpen(false);
    if (!bot && location.hash === "#cookie-settings") {
      history.replaceState(null, "", location.pathname + location.search);
      openSettings();
    }
    return () => setOpener(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any link to #cookie-settings reopens the settings.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (!href.endsWith("#cookie-settings")) return;
      e.preventDefault();
      openSettings();
    };
    const onHash = () => {
      if (location.hash !== "#cookie-settings") return;
      history.replaceState(null, "", location.pathname + location.search);
      openSettings();
    };
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHash);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHash);
    };
  }, [openSettings]);

  // Navigating to the privacy policy hides an unanswered banner; leaving it brings it back.
  useEffect(() => {
    if (!snap.ready || snap.state || isBot) return;
    if (pathname === PRIVACY_POLICY_PATH && view === "main") setOpen(false);
    else if (pathname !== PRIVACY_POLICY_PATH) setOpen(true);
  }, [pathname, snap.ready, snap.state, isBot, view]);

  function close() {
    setOpen(false);
    setView("main");
    const el = returnFocus.current;
    returnFocus.current = null;
    if (el && document.contains(el)) el.focus({ preventScroll: true });
  }

  const choose = (categories: ConsentCategories, decision: "accept_all" | "essentials" | "custom") => {
    commitChoice(categories, decision);
    close();
  };

  const showBanner = open && !isBot && !(pathname === PRIVACY_POLICY_PATH && !snap.state && view === "main");
  const statsOn = snap.ready && !isBot && !!snap.state?.categories.statistics;

  return (
    <>
      {showBanner ? (
        <ConsentBanner
          settings={settings}
          view={view}
          onView={(v) => {
            if (v === "settings") setDraft(getSnapshot().state?.categories ?? ESSENTIAL_ONLY);
            setView(v);
          }}
          draft={draft}
          onDraft={(g: ConsentGroup, on) => setDraft((d) => ({ ...d, [g]: on }))}
          onAcceptAll={() => choose(ALL_ALLOWED, "accept_all")}
          onContinue={() => choose(ESSENTIAL_ONLY, "essentials")}
          onSave={() => choose(draft, "custom")}
          onClose={snap.state ? close : undefined}
          retentionDays={retentionDays}
        />
      ) : null}
      {settings.floatingButton && snap.ready && snap.state && !isBot && !showBanner ? <PrivacyButton settings={settings} consentId={snap.state.id} onOpen={openSettings} /> : null}
      <StatsBeacon enabled={statsOn} consentId={snap.state?.id ?? null} pathname={pathname} />
    </>
  );
}

/**
 * Page views (including client-side navigations) and a heartbeat every 30 s
 * while the tab is visible. Runs only after Statistics consent; the server
 * re-checks the consent cookie before storing anything.
 */
function StatsBeacon({ enabled, consentId, pathname }: { enabled: boolean; consentId: string | null; pathname: string }) {
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !consentId || !isTrackablePath(pathname)) return;
    if (lastPath.current === pathname) return;
    const first = lastPath.current === null;
    const referrer = first ? document.referrer : lastPath.current;
    // Give the new page a moment to set its <title>.
    const timer = window.setTimeout(() => {
      lastPath.current = pathname;
      send({
          t: "pv",
          path: pathname,
          title: document.title,
          referrer,
          screen: `${screen.width}x${screen.height}`,
          lang: navigator.language,
        cid: consentId,
      });
    }, first ? 0 : 250);
    return () => window.clearTimeout(timer);
  }, [enabled, consentId, pathname]);

  useEffect(() => {
    if (!enabled || !consentId) return;
    const beat = () => {
      if (document.visibilityState === "visible") send({ t: "hb", cid: consentId });
    };
    const id = window.setInterval(beat, 30_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [enabled, consentId]);

  return null;
}

// Hits go out one at a time: the server sets the visit cookie on the first
// response, so a second hit sent before it returns would start a new visit.
let queue: Promise<unknown> = Promise.resolve();

function send(body: Record<string, unknown>) {
  queue = queue
    .then(() =>
      fetch("/api/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify(body),
      }),
    )
    .catch(() => {});
}

/** Optional round button bottom-left: change settings, revoke, show the consent id. */
function PrivacyButton({ settings, consentId, onOpen }: { settings: ConsentBannerSetting; consentId: string; onOpen: () => void }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);
  const vars = bannerCssVars({ ...settings, layout: "bar" });
  return (
    <div ref={ref} className="wbc-fab" style={vars as React.CSSProperties} data-consent-fab="">
      {menu ? (
        <div className="wbc-fab-menu" role="menu" aria-label="Privacy">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              onOpen();
            }}
          >
            Change privacy settings
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              revokeConsent();
              window.setTimeout(() => location.reload(), 150);
            }}
          >
            Revoke consents
          </button>
          <p className="wbc-fab-id">Your consent ID: {consentId}</p>
        </div>
      ) : null}
      <button type="button" className="wbc-fab-button" aria-haspopup="menu" aria-expanded={menu} aria-label="Privacy settings" onClick={() => setMenu((m) => !m)}>
        <Fingerprint aria-hidden />
      </button>
    </div>
  );
}
