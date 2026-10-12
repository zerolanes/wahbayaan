import { runAutoReleases } from "@/lib/commerce/orders";
import { refreshFxFromProvider } from "@/lib/commerce/fx-provider";
import { audit } from "@/lib/audit";
import { runScheduledBrandSyncs } from "@/lib/brands/sync";
import { runCleanup, summarizeCleanup } from "@/lib/analytics/store";
import { getSetting, setSetting } from "@/lib/settings";

/**
 * Scheduled jobs. Call with `Authorization: Bearer $CRON_SECRET` (Vercel Cron
 * sends this automatically when CRON_SECRET is set).
 *   /api/cron/auto-release — release held funds whose protection window ended
 *   /api/cron/fx-refresh   — pull live exchange rates from the provider
 *   /api/cron/brands       — sync Pakistani Brands catalogues whose sync is on
 *                            (each brand's recorded permission is re-checked)
 *   /api/cron/analytics-cleanup — visitor statistics retention (also runs by
 *                            itself at most once a day from the ingest route,
 *                            so it works on hosts without a scheduler)
 */
export async function GET(req: Request, ctx: RouteContext<"/api/cron/[job]">) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const { job } = await ctx.params;
  if (job === "auto-release") {
    const released = await runAutoReleases();
    if (released) await audit({ actorUserId: null, action: "cron.auto_release", entity: "orders", summary: `Auto-released funds for ${released} orders` });
    return Response.json({ released });
  }
  if (job === "fx-refresh") {
    const result = await refreshFxFromProvider();
    await audit({ actorUserId: null, action: "cron.fx_refresh", entity: "fx_rates", summary: result.ok ? "Exchange rates refreshed" : `FX refresh failed: ${result.error}`, data: result });
    return Response.json(result, { status: result.ok ? 200 : 502 });
  }
  if (job === "brands") {
    const results = await runScheduledBrandSyncs();
    return Response.json({ brands: results.length, results });
  }
  if (job === "analytics-cleanup") {
    const now = new Date();
    const result = await runCleanup(now);
    const summary = summarizeCleanup(result);
    await setSetting("analytics_maintenance", { ...(await getSetting("analytics_maintenance")), lastCleanupAt: now.toISOString(), lastSummary: summary });
    await audit({ actorUserId: null, action: "cron.analytics_cleanup", entity: "analytics", summary: `Visitor statistics cleanup: ${summary}`, data: result });
    return Response.json(result);
  }
  return new Response("Unknown job", { status: 404 });
}
