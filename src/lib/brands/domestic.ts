/**
 * Domestic delivery inside Pakistan (Pakistani Brands orders and overseas
 * buyers' gifts to Pakistan).
 *
 * The owner negotiates courier contracts; rate cards live in `shipping_rates`
 * (destination `PK`, a city `zone`, a weight band) linked to a courier in
 * Admin → Couriers. City zones and the brand-to-dispatch handling time are
 * settings. Everything is `pending` until entered and shown to buyers as
 * "Pending", never as zero. Pure.
 */
export type CityZone = { key: string; label: string; cities: string[] };

export type DomesticDeliverySetting = {
  zones: CityZone[];
  /** Days from ordering with the brand to dispatch from Wahbayaan. Null = pending. */
  handlingDays: number | null;
};

export const DEFAULT_DOMESTIC_DELIVERY: DomesticDeliverySetting = {
  // Zone structure only — no city lists are assumed; the admin fills them in.
  zones: [
    { key: "same_city", label: "Same city as our dispatch point", cities: [] },
    { key: "major_cities", label: "Major cities", cities: [] },
    { key: "other", label: "Rest of Pakistan", cities: [] },
  ],
  handlingDays: null,
};

export type DomesticRate = {
  courier: string;
  serviceName: string | null;
  zone: string | null;
  minWeightG: number;
  maxWeightG: number;
  /** PKR minor units; null = pending. */
  amount: number | null;
  currency: string;
  transitDaysMin: number | null;
  transitDaysMax: number | null;
  status: "pending" | "active" | "disabled";
  /** False when the rate's courier is switched off in Admin → Couriers. */
  courierActive?: boolean;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Which zone an address falls in. A city listed in a zone matches it; any other
 * city falls in the `other` zone once at least one zone lists cities. Null when
 * the city is unknown or zones aren't set up yet.
 */
export function zoneForCity(zones: CityZone[], city: string | null | undefined): CityZone | null {
  if (!city?.trim()) return null;
  const c = norm(city);
  const listed = zones.find((z) => z.cities.some((x) => norm(x) === c));
  if (listed) return listed;
  return zones.some((z) => z.cities.length > 0) ? (zones.find((z) => z.key === "other") ?? null) : null;
}

export type DomesticQuote =
  | { status: "known"; amountPkr: number; courier: string; serviceName: string | null; transitDaysMin: number | null; transitDaysMax: number | null; zone: CityZone }
  | { status: "pending"; reason: string };

/** Cheapest active PKR rate of an active courier for the zone and parcel weight. */
export function quoteDomestic(setting: DomesticDeliverySetting, rates: DomesticRate[], city: string | null | undefined, weightG: number | null): DomesticQuote {
  if (weightG == null || weightG <= 0) return { status: "pending", reason: "parcel weight not listed for every item" };
  const zone = zoneForCity(setting.zones, city);
  if (!zone) return { status: "pending", reason: city ? "delivery zones haven't been set up for this city yet" : "depends on the delivery city — confirmed at checkout" };
  const best = rates
    .filter(
      (r) =>
        r.status === "active" &&
        r.courierActive !== false &&
        r.amount != null &&
        r.currency === "PKR" &&
        r.zone === zone.key &&
        r.minWeightG <= weightG &&
        weightG <= r.maxWeightG,
    )
    .sort((a, b) => a.amount! - b.amount!)[0];
  if (!best) return { status: "pending", reason: "no confirmed courier rate for this zone and weight" };
  return { status: "known", amountPkr: best.amount!, courier: best.courier, serviceName: best.serviceName, transitDaysMin: best.transitDaysMin, transitDaysMax: best.transitDaysMax, zone };
}

/** `https://courier.example/track?n={tracking}` → a tracking link. Null without a template. */
export function buildTrackingUrl(template: string | null | undefined, tracking: string | null | undefined): string | null {
  if (!template || !tracking?.trim() || !template.includes("{tracking}")) return null;
  if (!/^https?:\/\//i.test(template)) return null;
  return template.replaceAll("{tracking}", encodeURIComponent(tracking.trim()));
}
