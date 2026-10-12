import { getCurrentUser } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";

/**
 * GET /admin/api/visitor-map/config — what the visitor map needs before it mounts:
 * the staff user's id (to key their saved map preferences) and the optional
 * Google Maps browser key from Admin → Settings → Visitor map.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "staff") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { googleMapsKey } = await getSetting("visitor_map");
  return Response.json({ userId: user.id, googleMapsKey: googleMapsKey || null }, { headers: { "cache-control": "no-store" } });
}
