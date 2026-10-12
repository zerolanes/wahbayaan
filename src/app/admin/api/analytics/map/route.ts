import { getVisitorMapData, MAP_RANGES, type MapRange } from "@/lib/analytics/map-data";
import { staffForRoute } from "@/lib/admin/route-auth";

/**
 * GET /admin/api/analytics/map?range=24h|7d|30d|90d|all&live=1&hideDc=1
 * Visitor map data for staff with `analytics.view` (see src/lib/analytics/map-data.ts).
 */
export async function GET(req: Request) {
  const auth = await staffForRoute("analytics.view");
  if ("error" in auth) return auth.error;
  const q = new URL(req.url).searchParams;
  const r = q.get("range") ?? "7d";
  const range: MapRange = (MAP_RANGES as readonly string[]).includes(r) ? (r as MapRange) : "7d";
  const flag = (v: string | null) => v === "1" || v === "true";
  const data = await getVisitorMapData({ range, liveOnly: flag(q.get("live")), hideDatacenter: flag(q.get("hideDc")) });
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}
