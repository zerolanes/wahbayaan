import { after, type NextRequest } from "next/server";
import { CONSENT_COOKIE, VISIT_COOKIE, VISIT_MINUTES, isBotUserAgent, isTrackablePath, statisticsConsentId } from "@/lib/consent/core";
import { clientIp, clip, cleanPath, cleanReferrer, cloudflareGeo } from "@/lib/analytics/request-info";
import { ipHash } from "@/lib/analytics/geo";
import { allowHit, allowNewVisit, getAnalyticsSettings, maybeRunDailyCleanup, recordHeartbeat, recordPageView } from "@/lib/analytics/store";
import { sameOrigin } from "@/lib/analytics/origin";

/**
 * First-party statistics beacon: { t: "pv" | "hb", path, title, referrer, screen, lang, cid }.
 * Stores nothing unless the consent cookie allows Statistics for the current
 * consent version. Bots and dashboard/API paths are dropped. The response is
 * sent at once; storage and the location lookup run in `after()`.
 */
const VISIT_KEY = /^[A-Za-z0-9_-]{16,64}$/;

function noContent(visitKey?: string) {
  const res = new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  if (visitKey) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.headers.append("set-cookie", `${VISIT_COOKIE}=${visitKey}; Path=/; Max-Age=${VISIT_MINUTES * 60}; HttpOnly; SameSite=Lax${secure}`);
  }
  return res;
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const ua = req.headers.get("user-agent");
  if (isBotUserAgent(ua)) return noContent();
  const raw = await req.text();
  if (raw.length > 4096) return new Response("Too large", { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const kind = body.t === "hb" ? "hb" : body.t === "pv" ? "pv" : null;
  if (!kind) return new Response("Bad request", { status: 400 });

  const settings = await getAnalyticsSettings();
  const consentId = statisticsConsentId(req.cookies.get(CONSENT_COOKIE)?.value, settings.consentRev);
  // No (current) Statistics consent: store nothing and forget any visit id.
  if (!consentId || (typeof body.cid === "string" && body.cid !== consentId)) {
    const res = noContent();
    if (req.cookies.get(VISIT_COOKIE)) res.headers.append("set-cookie", `${VISIT_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    return res;
  }

  const path = cleanPath(body.path);
  if (kind === "pv" && (!path || !isTrackablePath(path))) return noContent();

  const existing = req.cookies.get(VISIT_COOKIE)?.value;
  const ip = clientIp(req.headers);
  let visitKey = existing && VISIT_KEY.test(existing) ? existing : null;
  if (!visitKey) {
    if (kind === "hb") return noContent(); // heartbeats never start a visit
    if (!allowNewVisit(ip ? ipHash(ip) : "unknown")) return new Response("Too many requests", { status: 429 });
    visitKey = crypto.randomUUID().replace(/-/g, "");
  }
  if (!allowHit(visitKey, kind)) return noContent(visitKey);

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const referrer = cleanReferrer(body.referrer, host);
  const input = {
    visitKey,
    consentId,
    path: path ?? "/",
    title: clip(body.title, 300),
    referrer,
    visitReferrer: referrer && !referrer.startsWith("/") ? referrer : null,
    screen: clip(body.screen, 20),
    language: clip(body.lang, 35),
    userAgent: ua,
    ip,
    cfGeo: cloudflareGeo(req.headers),
  };
  const key = visitKey;
  after(async () => {
    try {
      if (kind === "pv") await recordPageView(input, settings);
      else await recordHeartbeat(key, consentId);
    } catch (err) {
      console.error("[analytics] store failed", err);
    }
    try {
      await maybeRunDailyCleanup();
    } catch (err) {
      console.error("[analytics] cleanup failed", err);
    }
  });
  return noContent(visitKey);
}
