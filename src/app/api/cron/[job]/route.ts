import { runAutoReleases } from "@/lib/commerce/orders";
import { refreshFxFromProvider } from "@/lib/commerce/fx-provider";
import { audit } from "@/lib/audit";

/**
 * Scheduled jobs. Call with `Authorization: Bearer $CRON_SECRET` (Vercel Cron
 * sends this automatically when CRON_SECRET is set).
 *   /api/cron/auto-release — release held funds whose protection window ended
 *   /api/cron/fx-refresh   — pull live exchange rates from the provider
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
  return new Response("Unknown job", { status: 404 });
}
