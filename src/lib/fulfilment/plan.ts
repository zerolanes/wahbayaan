/**
 * What the buyer is told about how their order travels, before and after
 * paying. Pure.
 *
 * - direct (domestic, or international while no hub is active): "Arrives in N
 *   parcels", one per seller, each "Ships from <city>".
 * - hub: "Shipped together from our hub" with the estimated dispatch date
 *   (slowest item + hub handling).
 */
import { estimateHubDispatch, itemReadyDays, type DispatchEstimate, type TimedItem } from "./consolidation";

export type PlanItem = TimedItem & { sellerKey: string; sellerName: string; sellerCity: string | null; qty: number };

export type PlanParcel = { sellerKey: string; sellerName: string; sellerCity: string | null; itemCount: number; readyDays: number | null };

export type FulfilmentPlan =
  | { mode: "direct"; domestic: boolean; parcels: PlanParcel[] }
  | { mode: "hub"; hubCity: string; parcels: PlanParcel[]; dispatch: DispatchEstimate };

export function parcelsBySeller(items: PlanItem[]): PlanParcel[] {
  const map = new Map<string, PlanParcel>();
  for (const i of items) {
    const p = map.get(i.sellerKey) ?? { sellerKey: i.sellerKey, sellerName: i.sellerName, sellerCity: i.sellerCity, itemCount: 0, readyDays: 0 as number | null };
    p.itemCount += i.qty;
    const d = itemReadyDays(i);
    p.readyDays = p.readyDays == null || d == null ? null : Math.max(p.readyDays, d);
    map.set(i.sellerKey, p);
  }
  return [...map.values()];
}

export function buildPlan(input: { mode: "direct" | "hub"; destination: string; items: PlanItem[]; hub?: { city: string; handlingDays: number | null } | null; start: Date }): FulfilmentPlan {
  const parcels = parcelsBySeller(input.items);
  if (input.mode === "hub" && input.hub)
    return { mode: "hub", hubCity: input.hub.city, parcels, dispatch: estimateHubDispatch(input.start, input.items, input.hub.handlingDays) };
  return { mode: "direct", domestic: input.destination === "PK", parcels };
}

/** "Arrives in 2 parcels" / "Arrives in 1 parcel". */
export function parcelsHeadline(n: number) {
  return `Arrives in ${n} parcel${n === 1 ? "" : "s"}`;
}
