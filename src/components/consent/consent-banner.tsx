"use client";

import { Fragment, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { StarMark } from "@/components/brand/logo";
import { bannerCssVars, isDialogLayout, type ConsentBannerSetting } from "@/lib/consent/banner-settings";
import type { ConsentCategories, ConsentGroup } from "@/lib/consent/core";
import { SERVICES, serviceFootnotes, visibleGroups, type ConsentService } from "@/lib/consent/services";
import "./consent.css";

export type BannerView = "main" | "settings";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The cookie banner itself (presentational). Used by the live consent manager
 * and by the admin's live preview (`preview`: absolutely positioned inside the
 * preview frame, no focus moves). Layout responds to the panel's own width via
 * container queries, so the preview shows the phone / tablet / desktop layouts.
 */
export function ConsentBanner({
  settings,
  view,
  onView,
  draft,
  onDraft,
  onAcceptAll,
  onContinue,
  onSave,
  onClose,
  preview = false,
  previewVh,
  retentionDays = 90,
  services = SERVICES,
}: {
  settings: ConsentBannerSetting;
  view: BannerView;
  onView: (v: BannerView) => void;
  draft: ConsentCategories;
  onDraft: (group: ConsentGroup, on: boolean) => void;
  onAcceptAll: () => void;
  onContinue: () => void;
  onSave: () => void;
  /** Escape / closing is only offered when a choice already exists. */
  onClose?: () => void;
  preview?: boolean;
  /** Preview frame height / 100, in px (stands in for 1vh). */
  previewVh?: number;
  retentionDays?: number;
  services?: ConsentService[];
}) {
  const t = settings.texts;
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dialog = isDialogLayout(settings.layout);
  const groups = visibleGroups(services);
  const notes = serviceFootnotes(services);
  const style = { ...bannerCssVars(settings), ...(previewVh ? { "--wbc-vh": `${previewVh}px` } : {}) } as CSSProperties;

  // Focus moves into the banner when it appears and when the view changes.
  useEffect(() => {
    if (preview) return;
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(view === "settings" ? ".wbc-back" : ".wbc-btn");
    (first ?? panel).focus({ preventScroll: true });
  }, [view, preview]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && onClose) {
      e.stopPropagation();
      onClose();
      return;
    }
    // Dialog layouts trap Tab inside the panel.
    if (e.key !== "Tab" || !dialog || preview) return;
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="wbc-root" data-layout={settings.layout} data-preview={preview ? "" : undefined} style={style} data-consent-banner="">
      <div
        ref={panelRef}
        className="wbc-panel"
        role="dialog"
        aria-modal={dialog && !preview ? true : undefined}
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-view={view}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="wbc-header">
          <div className="wbc-inner wbc-header-inner">
            <span className="wbc-logo" aria-hidden>
              <StarMark className="wbc-mark" />
              <span className="wbc-wordmark">Wahbayaan</span>
            </span>
            <h2 id={titleId} className="wbc-title">
              {t.title}
            </h2>
          </div>
        </div>

        <div className="wbc-body">
          {view === "main" ? (
            <div className="wbc-inner wbc-main">
              <div className="wbc-text">
                <p id={descId} className="wbc-desc">
                  {t.description}
                </p>
                <hr className="wbc-sep" />
                <p className="wbc-small">
                  By accepting all services, you consent to the activation of{" "}
                  {notes.services.map((s, i) => (
                    <Fragment key={s.name}>
                      {i > 0 ? (i === notes.services.length - 1 ? " and " : ", ") : null}
                      {s.name}
                      <sup>{s.n}</sup>
                    </Fragment>
                  ))}
                  . These services are categorized by purpose:{" "}
                  {notes.groups.map((g, i) => (
                    <Fragment key={g.name}>
                      {i > 0 ? ", " : null}
                      {g.name}
                      <sup>{g.n}</sup>
                    </Fragment>
                  ))}
                  .
                </p>
              </div>
              <div className="wbc-actions">
                <div className="wbc-buttons">
                  <button type="button" className="wbc-btn" data-consent-action="accept" onClick={onAcceptAll}>
                    {t.acceptAll}
                  </button>
                  <button type="button" className="wbc-btn" data-consent-action="continue" onClick={onContinue}>
                    {t.continueWithout}
                  </button>
                </div>
                <button type="button" className="wbc-link wbc-individual" data-consent-action="individual" onClick={() => onView("settings")}>
                  {t.individual}
                </button>
              </div>
            </div>
          ) : (
            <div className="wbc-inner wbc-settings">
              <button type="button" className="wbc-link wbc-back" data-consent-action="back" onClick={() => onView("main")}>
                <span aria-hidden>←</span> {t.back}
              </button>
              <p id={descId} className="wbc-small wbc-settings-intro">
                Choose which services we may use. Essential cookies are always on because the shop needs them to work.
              </p>
              <ul className="wbc-groups">
                {groups.map((g) => (
                  <GroupBox
                    key={g.id}
                    group={g}
                    services={services.filter((s) => s.group === g.id)}
                    checked={g.id === "essential" ? true : draft[g.id]}
                    onChange={(on) => onDraft(g.id, on)}
                    texts={t}
                    retentionDays={retentionDays}
                  />
                ))}
              </ul>
              <div className="wbc-actions wbc-actions-settings">
                <button type="button" className="wbc-btn" data-consent-action="save" onClick={onSave}>
                  {t.save}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="wbc-footer">
          <div className="wbc-inner">
            <a href={t.privacyUrl} target="_blank" rel="noopener" className="wbc-footer-link">
              {t.privacyLabel}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupBox({
  group,
  services,
  checked,
  onChange,
  texts,
  retentionDays,
}: {
  group: { id: ConsentGroup; name: string; description: string };
  services: ConsentService[];
  checked: boolean;
  onChange: (on: boolean) => void;
  texts: ConsentBannerSetting["texts"];
  retentionDays: number;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const essential = group.id === "essential";
  return (
    <li className="wbc-group" data-group={group.id}>
      <div className="wbc-group-head">
        <label className="wbc-group-label">
          <input
            type="checkbox"
            role="switch"
            className="wbc-switch"
            checked={checked}
            disabled={essential}
            aria-checked={checked}
            aria-describedby={`${id}-desc`}
            onChange={(e) => onChange(e.target.checked)}
            data-consent-group={group.id}
          />
          <span className="wbc-group-name">{group.name}</span>
        </label>
        {essential ? <span className="wbc-always">{texts.alwaysActive}</span> : null}
      </div>
      <p id={`${id}-desc`} className="wbc-group-desc">
        {group.description}
      </p>
      {services.length ? (
        <>
          <button type="button" className="wbc-link wbc-more" aria-expanded={open} aria-controls={`${id}-services`} onClick={() => setOpen((o) => !o)}>
            {open ? texts.hideServices : texts.showServices}
          </button>
          <div id={`${id}-services`} className="wbc-services" hidden={!open}>
            {services.map((s) => (
              <div key={s.id} className="wbc-service">
                <p className="wbc-service-name">{s.name}</p>
                <dl>
                  <dt>Provider</dt>
                  <dd>{s.provider}</dd>
                  <dt>Purpose</dt>
                  <dd>{s.purpose}</dd>
                  <dt>Legal basis</dt>
                  <dd>{s.legalBasis}</dd>
                  <dt>Data processing in</dt>
                  <dd>{s.processingIn}</dd>
                  <dt>Cookies used</dt>
                  <dd>
                    <ul className="wbc-cookies">
                      {s.cookies.map((c) => (
                        <li key={c.name}>
                          <code>{c.name}</code> · {c.duration} · {c.purpose}
                        </li>
                      ))}
                    </ul>
                  </dd>
                  <dt>Retention</dt>
                  <dd>{s.id === "visitor-statistics" ? `${retentionDays} days, then deleted automatically` : s.retention}</dd>
                </dl>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </li>
  );
}
