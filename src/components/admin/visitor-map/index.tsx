"use client";

import "./visitor-map.css";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/** The map (d3-geo, TopoJSON, canvas engine) is its own chunk, loaded only where a map is mounted. */
const VisitorMap = dynamic(() => import("./visitor-map").then((m) => m.VisitorMap), {
  ssr: false,
  loading: () => null,
});

export type VisitorMapSlotProps = {
  /** "background": fixed behind the page, cards go translucent. "card": a map inside a card. */
  mode?: "background" | "card";
  /** Search param the map writes when a cross is pinned ("GB" or "GB:London"), so the host page can filter its table. */
  tableFilterParam?: string;
  /** JSON endpoint returning the VisitorMapData contract. */
  dataUrl?: string;
  /** Table-heavy screens: start with the controls collapsed to a title bar. */
  compact?: boolean;
};

type MapConfig = { userId: string | null; googleMapsKey: string | null };

let configPromise: Promise<MapConfig> | null = null;
function loadConfig(): Promise<MapConfig> {
  configPromise ??= fetch("/admin/api/visitor-map/config", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<MapConfig>) : { userId: null, googleMapsKey: null }))
    .catch(() => ({ userId: null, googleMapsKey: null }));
  return configPromise;
}

/**
 * Drop-in visitor map for the admin Statistics and Live screens.
 *
 *   <VisitorMapSlot mode="background" tableFilterParam="place" />
 *
 * Reads GET /admin/api/analytics/map?range=&live=&hideDc= (staff-only) and polls it.
 */
export function VisitorMapSlot({
  mode = "background",
  tableFilterParam = "place",
  dataUrl = "/admin/api/analytics/map",
  compact = false,
}: VisitorMapSlotProps) {
  const [config, setConfig] = useState<MapConfig | null>(null);
  useEffect(() => {
    let alive = true;
    loadConfig().then((c) => alive && setConfig(c));
    return () => {
      alive = false;
    };
  }, []);
  if (!config) {
    // Reserve the card's space (background mode takes none) so the page doesn't jump.
    return mode === "card" ? <div className="vm-root vm-root-card" aria-hidden /> : null;
  }
  return (
    <VisitorMap
      mode={mode}
      tableFilterParam={tableFilterParam}
      dataUrl={dataUrl}
      compact={compact}
      userId={config.userId}
      googleMapsKey={config.googleMapsKey}
    />
  );
}
