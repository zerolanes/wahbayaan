import { cookies, headers } from "next/headers";
import { CONSENT_COOKIE, PRIVACY_POLICY_PATH, isBotUserAgent, isCurrent, parseConsent } from "@/lib/consent/core";
import { getAnalyticsSettings, getConsentBanner } from "@/lib/analytics/store";
import { ConsentManager } from "./consent-manager";

/**
 * Server half of the cookie banner: bots (by user agent) get no banner markup
 * at all, the privacy policy page never opens it, and a visitor without a
 * choice for the current consent version sees it in the first paint.
 */
export async function ConsentRoot() {
  const [h, jar, banner, analytics] = await Promise.all([headers(), cookies(), getConsentBanner(), getAnalyticsSettings()]);
  const bot = isBotUserAgent(h.get("user-agent"));
  const path = h.get("x-wb-path") ?? "";
  const state = parseConsent(jar.get(CONSENT_COOKIE)?.value);
  const initiallyOpen = !bot && !isCurrent(state, analytics.consentRev) && path !== PRIVACY_POLICY_PATH;
  return <ConsentManager settings={banner} rev={analytics.consentRev} retentionDays={analytics.retentionDays} bot={bot} initiallyOpen={initiallyOpen} />;
}
