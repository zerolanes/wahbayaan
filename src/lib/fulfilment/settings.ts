import { DEFAULT_VOLUMETRIC_DIVISOR } from "./consolidation";

/** Admin → Hubs settings. Pure (no business numbers are invented: thresholds are operational defaults staff can change). */
export type FulfilmentSetting = {
  /** International orders consolidate at an active origin hub (the owner's model). Without an active hub they ship direct. */
  consolidateInternational: boolean;
  /** A seller this many days past their expected hand-over counts as late (staff may then ship the ready items). */
  lateThresholdDays: number;
  /** cm³ per kg for volumetric weight. */
  volumetricDivisor: number;
  /** Later phase: let domestic buyers opt for one delivery via a city hub. */
  cityHubs: boolean;
  /** Later phase: route international boxes through a forwarder hub in the destination country. */
  forwarders: boolean;
  /** Booking adapter per courier id (manual by default). */
  courierAdapters: Record<string, string>;
  /** Shown to sellers on the "Send to hub" screen. */
  dropOffInstructions: string | null;
};

export const DEFAULT_FULFILMENT: FulfilmentSetting = {
  consolidateInternational: true,
  lateThresholdDays: 3,
  volumetricDivisor: DEFAULT_VOLUMETRIC_DIVISOR,
  cityHubs: false,
  forwarders: false,
  courierAdapters: {},
  dropOffInstructions: null,
};

/** How an order is fulfilled. Domestic → direct from each seller; international → the active origin hub when consolidation is on. */
export function routeOrder(input: { destination: string; setting: Pick<FulfilmentSetting, "consolidateInternational">; activeOriginHubId: string | null }): { mode: "direct" | "hub"; hubId: string | null } {
  if (input.destination === "PK") return { mode: "direct", hubId: null };
  if (input.setting.consolidateInternational && input.activeOriginHubId) return { mode: "hub", hubId: input.activeOriginHubId };
  return { mode: "direct", hubId: null };
}
