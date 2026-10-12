/**
 * Domestic orders (buyer in Pakistan) ship DIRECT from each seller, so delivery
 * is the sum of one courier rate per parcel. Each parcel is priced from the
 * courier rate cards (destination `PK`, a city zone, a weight band): a parcel
 * whose seller is in the buyer's own city uses the "same city" zone — usually
 * the cheapest. If ANY parcel has no confirmed rate, the total is pending —
 * never zero and never a partial sum presented as the total. Pure.
 */
import type { CityZone, DomesticDeliverySetting, DomesticRate } from "@/lib/brands/domestic";

export const SAME_CITY_ZONE = "same_city";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Zone of a seller → buyer parcel: same city when the seller's city is the
 * buyer's (and a same-city zone exists); otherwise the zone listing the buyer's
 * city, or "other" once zones list cities. Null = zones not set up / city unknown.
 */
export function zoneForParcel(zones: CityZone[], originCity: string | null | undefined, destCity: string | null | undefined): CityZone | null {
  if (!norm(destCity)) return null;
  const same = zones.find((z) => z.key === SAME_CITY_ZONE);
  if (same && norm(originCity) && norm(originCity) === norm(destCity)) return same;
  const others = zones.filter((z) => z.key !== SAME_CITY_ZONE);
  const listed = others.find((z) => z.cities.some((c) => norm(c) === norm(destCity)));
  if (listed) return listed;
  return zones.some((z) => z.cities.length > 0) ? (others.find((z) => z.key === "other") ?? null) : null;
}

export type DomesticParcelInput = {
  /** Vendor id (artisan) or another stable key. */
  key: string;
  label: string;
  originCity: string | null;
  /** Packed weight of the parcel (sum of listed item weights). Null = not listed. */
  weightG: number | null;
};

export type DomesticParcelQuote = {
  key: string;
  label: string;
  originCity: string | null;
  zone: CityZone | null;
  weightG: number | null;
} & (
  | { status: "known"; amountPkr: number; courier: string; serviceName: string | null; transitDaysMin: number | null; transitDaysMax: number | null }
  | { status: "pending"; reason: string }
);

export type DomesticParcelsQuote = {
  parcels: DomesticParcelQuote[];
  /** Sum of every parcel, PKR minor units — null (pending) unless every parcel is priced. */
  totalPkr: number | null;
  status: "known" | "pending";
  reason?: string;
};

function cheapest(rates: DomesticRate[], zoneKey: string, weightG: number) {
  return rates
    .filter(
      (r) =>
        r.status === "active" &&
        r.courierActive !== false &&
        r.amount != null &&
        r.currency === "PKR" &&
        r.zone === zoneKey &&
        r.minWeightG <= weightG &&
        weightG <= r.maxWeightG,
    )
    .sort((a, b) => a.amount! - b.amount!)[0];
}

export function quoteDomesticParcels(setting: DomesticDeliverySetting, rates: DomesticRate[], buyerCity: string | null | undefined, parcels: DomesticParcelInput[]): DomesticParcelsQuote {
  const quoted: DomesticParcelQuote[] = parcels.map((p) => {
    const base = { key: p.key, label: p.label, originCity: p.originCity, weightG: p.weightG };
    if (p.weightG == null || p.weightG <= 0) return { ...base, zone: null, status: "pending", reason: `shipping weight not listed for every item from ${p.label}` };
    const zone = zoneForParcel(setting.zones, p.originCity, buyerCity);
    if (!zone)
      return { ...base, zone: null, status: "pending", reason: buyerCity ? "delivery zones haven't been set up for this city yet" : "depends on the delivery city — confirmed at checkout" };
    const best = cheapest(rates, zone.key, p.weightG);
    if (!best) return { ...base, zone, status: "pending", reason: `no confirmed courier rate for ${zone.label.toLowerCase()} at this weight` };
    return { ...base, zone, status: "known", amountPkr: best.amount!, courier: best.courier, serviceName: best.serviceName, transitDaysMin: best.transitDaysMin, transitDaysMax: best.transitDaysMax };
  });
  const pending = quoted.filter((q) => q.status === "pending");
  if (!quoted.length) return { parcels: [], totalPkr: null, status: "pending", reason: "no parcels" };
  if (pending.length) return { parcels: quoted, totalPkr: null, status: "pending", reason: (pending[0] as { reason: string }).reason };
  return { parcels: quoted, totalPkr: quoted.reduce((a, q) => a + (q.status === "known" ? q.amountPkr : 0), 0), status: "known" };
}
