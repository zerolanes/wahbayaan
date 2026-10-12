import { MapPinned } from "lucide-react";

/**
 * ─── VISITOR MAP SLOT ────────────────────────────────────────────────────────
 * Placeholder for the visitor map, which is built separately and replaces this
 * component at merge. It is rendered on Insights → Visitor statistics and
 * Live now. Data: `getVisitorMapData()` in src/lib/analytics/map-data.ts, or
 * GET /admin/api/analytics/map?range=24h|7d|30d|90d|all&live=1&hideDc=1.
 */
export function VisitorMapSlot({ live = false }: { live?: boolean; range?: string }) {
  return (
    <section
      data-visitor-map-slot={live ? "live" : "stats"}
      className="grid min-h-48 place-items-center rounded-[var(--radius-card)] border border-dashed border-umber-300 bg-white p-6 text-center"
      aria-label="Visitor map"
    >
      <div className="max-w-sm">
        <MapPinned className="mx-auto size-6 text-umber-400" aria-hidden />
        <p className="mt-2 text-sm font-medium text-umber-800">Visitor map</p>
        <p className="mt-1 text-xs text-umber-500">{live ? "Where live visitors are right now" : "Where visitors came from"} — the map appears here.</p>
      </div>
    </section>
  );
}
