/**
 * Price of a Pakistani Brands order in the buyer's currency.
 *
 * Reuses the landed-cost engine for both routes so the honesty rules are
 * identical everywhere:
 * - Ship to Pakistan (a domestic buyer, or an overseas buyer's gift): item +
 *   delivery within Pakistan (cheapest active courier rate for the city's zone
 *   and the box weight — pending until entered) + Wahbayaan service fee. Import
 *   duty is not applicable.
 * - Ship abroad: item + international shipping + duty + import tax (all pending
 *   until real rates exist) + Wahbayaan service fee.
 *
 * Wahbayaan consolidates every item into one box, so there is one shipment.
 * The buyer's currency is whatever their context says — PKR for buyers in
 * Pakistan, USD/GBP/CAD for overseas buyers even when the box goes to Pakistan.
 * Pure.
 */
import { computeLandedCost, PENDING_NOTE, type LandedCost, type LcDutyRate, type LcLine, type LcShippingRate } from "@/lib/commerce/landed-cost";
import { convertFromPkr, isDomestic, type FxQuote } from "@/lib/money/currency";
import { zoneForCity, type DomesticDeliverySetting, type DomesticRate } from "./domestic";
import { computeServiceFee, type BrandMarginSetting } from "./margin";

export type BrandQuoteItem = {
  key: string;
  title: string;
  unitPricePkr: number;
  qty: number;
  weightG: number | null;
  hsCode?: string | null;
};

export type BrandQuoteInput = {
  items: BrandQuoteItem[];
  /** `PK` or an import destination. */
  shipTo: string;
  /** Delivery city (domestic zone lookup). Unknown before checkout. */
  city?: string | null;
  fx: FxQuote;
  fxTable: Partial<Record<string, FxQuote>>;
  margin: BrandMarginSetting;
  domestic: { setting: DomesticDeliverySetting; rates: DomesticRate[] };
  international: { shippingRates: (LcShippingRate & { courierActive?: boolean })[]; dutyRates: LcDutyRate[] };
};

export const SERVICE_FEE_LABEL = "Wahbayaan service fee";
export const BRAND_SHIPMENT_ID = "wahbayaan";

export function serviceFeeLine(margin: BrandMarginSetting, domestic: boolean, itemsSubtotalPkr: number, fx: FxQuote): LcLine & { feePkr: number | null } {
  const fee = computeServiceFee(domestic ? margin.domestic : margin.international, itemsSubtotalPkr);
  if (fee.status === "pending")
    return { key: "service_fee", label: SERVICE_FEE_LABEL, status: "pending", amount: null, feePkr: null, note: `${PENDING_NOTE} — ${fee.reason}` };
  return { key: "service_fee", label: SERVICE_FEE_LABEL, status: "known", amount: convertFromPkr(fee.feePkr, fx), feePkr: fee.feePkr, note: `Our fee for buying and handling your order (${fee.basis})` };
}

export function computeBrandQuote(input: BrandQuoteInput): LandedCost & { serviceFeePkr: number | null; itemsSubtotalPkr: number } {
  const domestic = isDomestic(input.shipTo);
  const itemsSubtotalPkr = input.items.reduce((a, i) => a + i.unitPricePkr * i.qty, 0);
  const fee = serviceFeeLine(input.margin, domestic, itemsSubtotalPkr, input.fx);
  const zone = domestic ? zoneForCity(input.domestic.setting.zones, input.city) : null;

  const shippingRates: LcShippingRate[] = domestic
    ? input.domestic.rates
        .filter((r) => r.courierActive !== false && zone && r.zone === zone.key)
        .map((r) => ({ ...r, destinationCountry: "PK" }))
    : input.international.shippingRates.filter((r) => r.courierActive !== false);

  const feeLine: LcLine = { key: fee.key, label: fee.label, status: fee.status, amount: fee.amount, note: fee.note };
  const landed = computeLandedCost({
    items: input.items.map((i) => ({
      productId: i.key,
      vendorId: BRAND_SHIPMENT_ID,
      categoryId: "brand",
      hsCode: i.hsCode ?? null,
      title: i.title,
      unitPricePkr: i.unitPricePkr,
      qty: i.qty,
      weightG: i.weightG,
      availability: "ready_to_ship",
      timeToMakeDays: null,
      dispatchDays: input.domestic.setting.handlingDays,
    })),
    destination: input.shipTo,
    fx: input.fx,
    fxTable: input.fxTable,
    shippingRates,
    dutyRates: domestic ? [] : input.international.dutyRates,
    handling: { status: "pending" },
    omitHandling: true,
    extraLines: [feeLine],
    shippingNote: "Wahbayaan packs your order into one box",
  });

  // A clearer reason than "no rate" when we simply don't know the city yet.
  if (domestic && !zone) {
    const ship = landed.lines.find((l) => l.key === "shipping");
    if (ship && ship.status === "pending" && input.items.every((i) => i.weightG))
      ship.note = `${PENDING_NOTE} — ${input.city ? "delivery zones haven't been set up for this city yet" : "depends on the delivery city, confirmed at checkout"}`;
  }
  return { ...landed, serviceFeePkr: fee.feePkr, itemsSubtotalPkr };
}
