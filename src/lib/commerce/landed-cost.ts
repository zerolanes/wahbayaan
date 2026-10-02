/**
 * Landed-cost engine: item price + international shipping + import duty + import
 * tax + Wahbayaan handling (+ gift wrap − discount), in the buyer's currency.
 *
 * Pure and synchronous so it can run on the product page, in the cart, at
 * checkout and in tests with identical results.
 *
 * Destination `PK` is domestic delivery (Pakistani Brands, or gifts sent to
 * Pakistan): the shipping line reads "Delivery within Pakistan" and import duty
 * is not applicable — but shipping still stays pending until a real rate exists.
 *
 * Honesty rule: a line whose real rate has not been supplied is returned as
 * `pending` with `amount: null`. It is never priced at zero and never guessed.
 */
import { applyBps, convert, convertFromPkr, isDomestic, type Currency, type FxQuote } from "@/lib/money/currency";
import { FREIGHT_THRESHOLD_G } from "./freight";

export type LineKey = "items" | "shipping" | "duty" | "import_tax" | "handling" | "service_fee" | "gift_wrap" | "discount";

export const DOMESTIC_NO_DUTY_NOTE = "Delivered within Pakistan — no import duty or customs";
export type LineStatus = "known" | "pending" | "not_applicable";

export type LcItem = {
  productId: string;
  vendorId: string;
  categoryId: string;
  hsCode?: string | null;
  title: string;
  unitPricePkr: number;
  qty: number;
  weightG: number | null;
  availability: "ready_to_ship" | "made_to_order";
  timeToMakeDays: number | null;
  dispatchDays: number | null;
};

export type LcShippingRate = {
  id?: string;
  courier: string;
  serviceName?: string | null;
  destinationCountry: string;
  minWeightG: number;
  maxWeightG: number;
  amount: number | null;
  currency: string;
  transitDaysMin: number | null;
  transitDaysMax: number | null;
  status: "pending" | "active" | "disabled";
};

export type LcDutyRate = {
  destinationCountry: string;
  categoryId: string | null;
  hsCode: string | null;
  dutyPercent: number | null;
  taxPercent: number | null;
  taxLabel: string | null;
  deMinimisAmount: number | null;
  deMinimisCurrency: string | null;
  basis: "item" | "item_plus_shipping";
  status: "pending" | "active" | "disabled";
};

export type HandlingFeeSetting =
  | { status: "pending" }
  | { status: "active"; kind: "fixed"; amount: number; currency: Currency }
  | { status: "active"; kind: "percent"; percentBps: number };

export type GiftWrapSetting =
  | { status: "pending" }
  | { status: "disabled" }
  | { status: "active"; amount: number; currency: Currency };

export type LcLine = {
  key: LineKey;
  label: string;
  status: LineStatus;
  amount: number | null;
  note?: string;
};

export type ShipmentQuote = {
  vendorId: string;
  weightG: number | null;
  status: "known" | "pending";
  courier?: string;
  serviceName?: string | null;
  amount?: number;
  transitDaysMin?: number | null;
  transitDaysMax?: number | null;
  reason?: string;
};

export type DeliveryEstimate = {
  /** Longest time any artisan needs before the parcel can leave Pakistan. */
  productionDaysMax: number | null;
  transitDaysMin: number | null;
  transitDaysMax: number | null;
  status: "known" | "partial" | "pending";
};

export type LandedCost = {
  currency: Currency;
  destination: string;
  fx: FxQuote;
  lines: LcLine[];
  /** Sum of every known line. Equal to the final total only when `complete`. */
  knownTotal: number;
  complete: boolean;
  pendingLines: LcLine[];
  itemsSubtotal: number;
  shipments: ShipmentQuote[];
  delivery: DeliveryEstimate;
  importNote?: string;
};

export type LcInput = {
  items: LcItem[];
  destination: string;
  fx: FxQuote;
  /** Rates for every currency a courier or de-minimis threshold may be quoted in. */
  fxTable: Partial<Record<string, FxQuote>>;
  shippingRates: LcShippingRate[];
  dutyRates: LcDutyRate[];
  handling: HandlingFeeSetting;
  giftWrap?: { selected: boolean; setting: GiftWrapSetting };
  discount?: { amount: number; label: string };
  /** Leave the Wahbayaan handling line out (Pakistani Brands charge a service fee line instead). */
  omitHandling?: boolean;
  /** Further lines in the buyer's currency (e.g. the brand service fee), inserted after handling. */
  extraLines?: LcLine[];
  /** Overrides the shipping note when every parcel ships from one place (e.g. Wahbayaan consolidates brand orders). */
  shippingNote?: string;
};

export const PENDING_NOTE = "Pending real rate data";

function fxFor(currency: string, input: LcInput): FxQuote | null {
  if (currency === "PKR") return { currency: "PKR", pkrPerUnit: 1, source: "identity", status: "live" };
  if (currency === input.fx.currency) return input.fx;
  return input.fxTable[currency] ?? null;
}

/** Unit price the buyer sees, in their currency. */
export function buyerUnitPrice(unitPricePkr: number, fx: FxQuote) {
  return convertFromPkr(unitPricePkr, fx);
}

export { FREIGHT_THRESHOLD_G };

function quoteShipments(input: LcInput): ShipmentQuote[] {
  const byVendor = new Map<string, LcItem[]>();
  for (const item of input.items) {
    const list = byVendor.get(item.vendorId) ?? [];
    list.push(item);
    byVendor.set(item.vendorId, list);
  }

  const quotes: ShipmentQuote[] = [];
  for (const [vendorId, items] of byVendor) {
    const missingWeight = items.filter((i) => !i.weightG || i.weightG <= 0);
    if (missingWeight.length) {
      quotes.push({
        vendorId,
        weightG: null,
        status: "pending",
        reason: `Shipping weight not listed for ${missingWeight.map((i) => i.title).join(", ")}`,
      });
      continue;
    }
    const weightG = items.reduce((sum, i) => sum + (i.weightG ?? 0) * i.qty, 0);
    const candidates = input.shippingRates
      .filter(
        (r) =>
          r.status === "active" &&
          r.amount != null &&
          r.destinationCountry === input.destination &&
          r.minWeightG <= weightG &&
          weightG <= r.maxWeightG,
      )
      .map((r) => {
        const rateFx = fxFor(r.currency, input);
        return rateFx ? { rate: r, amount: convert(r.amount!, rateFx, input.fx) } : null;
      })
      .filter((c): c is { rate: LcShippingRate; amount: number } => c !== null)
      .sort((a, b) => a.amount - b.amount);

    const best = candidates[0];
    if (!best) {
      const reason =
        weightG > FREIGHT_THRESHOLD_G
          ? "Freight shipment — our logistics team quotes delivery for large pieces; nothing is charged until you approve it"
          : "No confirmed courier rate for this destination and weight";
      quotes.push({ vendorId, weightG, status: "pending", reason });
      continue;
    }
    quotes.push({
      vendorId,
      weightG,
      status: "known",
      courier: best.rate.courier,
      serviceName: best.rate.serviceName,
      amount: best.amount,
      transitDaysMin: best.rate.transitDaysMin,
      transitDaysMax: best.rate.transitDaysMax,
    });
  }
  return quotes;
}

function findDutyRate(item: LcItem, input: LcInput): LcDutyRate | null {
  const forCountry = input.dutyRates.filter((r) => r.destinationCountry === input.destination && r.status !== "disabled");
  return (
    (item.hsCode ? forCountry.find((r) => r.hsCode && r.hsCode === item.hsCode) : undefined) ??
    forCountry.find((r) => r.categoryId === item.categoryId && !r.hsCode) ??
    forCountry.find((r) => r.categoryId == null && !r.hsCode) ??
    null
  );
}

function deliveryEstimate(items: LcItem[], shipments: ShipmentQuote[]): DeliveryEstimate {
  const production = items.map((i) => (i.availability === "made_to_order" ? i.timeToMakeDays : i.dispatchDays));
  const productionDaysMax = production.some((d) => d == null) ? null : Math.max(0, ...(production as number[]));
  const known = shipments.filter((s) => s.status === "known");
  const allKnown = shipments.length > 0 && known.length === shipments.length;
  const mins = known.map((s) => s.transitDaysMin).filter((d): d is number => d != null);
  const maxs = known.map((s) => s.transitDaysMax).filter((d): d is number => d != null);
  const transitDaysMin = allKnown && mins.length === known.length ? Math.max(...mins) : null;
  const transitDaysMax = allKnown && maxs.length === known.length ? Math.max(...maxs) : null;
  const status =
    productionDaysMax != null && transitDaysMax != null
      ? "known"
      : productionDaysMax != null || transitDaysMax != null
        ? "partial"
        : "pending";
  return { productionDaysMax, transitDaysMin, transitDaysMax, status };
}

export function computeLandedCost(input: LcInput): LandedCost {
  const { fx } = input;
  const lines: LcLine[] = [];

  // 1. Items
  const itemValues = input.items.map((i) => buyerUnitPrice(i.unitPricePkr, fx) * i.qty);
  const itemsSubtotal = itemValues.reduce((a, b) => a + b, 0);
  const count = input.items.reduce((a, i) => a + i.qty, 0);
  lines.push({
    key: "items",
    label: count === 1 ? "Item" : `Items (${count})`,
    status: "known",
    amount: itemsSubtotal,
  });

  // 2. Shipping
  const shipments = quoteShipments(input);
  const shippingPending = shipments.filter((s) => s.status === "pending");
  const shippingAmount = shippingPending.length ? null : shipments.reduce((a, s) => a + (s.amount ?? 0), 0);
  // Delivery inside Pakistan is domestic: no international leg, no duty, no import tax.
  const domestic = isDomestic(input.destination);
  const shippingWord = domestic ? "Delivery within Pakistan" : "International shipping";
  lines.push({
    key: "shipping",
    label: shipments.length > 1 ? `${shippingWord} (${shipments.length} parcels)` : shippingWord,
    status: shippingAmount == null ? "pending" : "known",
    amount: shippingAmount,
    note:
      shippingAmount == null
        ? `${PENDING_NOTE} — ${shippingPending[0]?.reason ?? "courier rates not confirmed"}`
        : (input.shippingNote ?? (shipments.length > 1 ? "Each artisan ships separately from their workshop" : undefined)),
  });

  // 3. Import duty and 4. import tax
  const matched = input.items.map((item, idx) => ({ item, value: itemValues[idx], rate: findDutyRate(item, input) }));
  const dutyPendingReason = domestic
    ? null
    : matched.some((m) => !m.rate || m.rate.status !== "active" || m.rate.dutyPercent == null)
    ? "duty rates for this destination and craft have not been confirmed"
    : matched.some((m) => m.rate!.basis === "item_plus_shipping") && shippingAmount == null
      ? "duty is charged on the shipping cost too, which is still pending"
      : null;

  let dutyAmount: number | null = null;
  let taxAmount: number | null = null;
  let taxApplicable = true;
  let dutyNote: string | undefined;
  let taxLabel = "Import tax";

  if (!dutyPendingReason && !domestic) {
    const rates = matched.map((m) => m.rate!);
    // De minimis: below the destination's threshold no duty is charged.
    const threshold = rates
      .filter((r) => r.deMinimisAmount != null && r.deMinimisCurrency)
      .map((r) => {
        const tfx = fxFor(r.deMinimisCurrency!, input);
        return tfx ? convert(r.deMinimisAmount!, tfx, fx) : null;
      })
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b)[0];

    const shippingShare = (value: number) =>
      shippingAmount && itemsSubtotal > 0 ? Math.round((shippingAmount * value) / itemsSubtotal) : 0;

    if (threshold != null && itemsSubtotal <= threshold) {
      dutyAmount = 0;
      dutyNote = "Order value is under this destination's duty-free threshold";
    } else {
      dutyAmount = matched.reduce((sum, m) => {
        const base = m.value + (m.rate!.basis === "item_plus_shipping" ? shippingShare(m.value) : 0);
        return sum + applyBps(base, Math.round(Number(m.rate!.dutyPercent) * 100));
      }, 0);
    }

    const taxRates = rates.filter((r) => r.taxPercent != null && Number(r.taxPercent) > 0);
    taxLabel = rates.find((r) => r.taxLabel)?.taxLabel ?? taxLabel;
    if (!taxRates.length) {
      taxApplicable = false;
    } else {
      const dutyByItem = matched.map((m) =>
        dutyAmount && dutyAmount > 0 && itemsSubtotal > 0 ? Math.round((dutyAmount * m.value) / itemsSubtotal) : 0,
      );
      taxAmount = matched.reduce((sum, m, idx) => {
        if (m.rate!.taxPercent == null) return sum;
        const base = m.value + shippingShare(m.value) + dutyByItem[idx];
        return sum + applyBps(base, Math.round(Number(m.rate!.taxPercent) * 100));
      }, 0);
    }
  }

  if (domestic) {
    lines.push({ key: "duty", label: "Import duty", status: "not_applicable", amount: null, note: DOMESTIC_NO_DUTY_NOTE });
  } else {
    lines.push({
      key: "duty",
      label: "Import duty",
      status: dutyPendingReason ? "pending" : "known",
      amount: dutyAmount,
      note: dutyPendingReason ? `${PENDING_NOTE} — ${dutyPendingReason}` : dutyNote,
    });
    lines.push({
      key: "import_tax",
      label: taxLabel,
      status: dutyPendingReason ? "pending" : taxApplicable ? "known" : "not_applicable",
      amount: taxApplicable ? taxAmount : null,
      note: dutyPendingReason
        ? `${PENDING_NOTE} — import tax is confirmed together with duty`
        : taxApplicable
          ? undefined
          : "No import tax applies for this destination",
    });
  }

  // 5. Handling fee
  const handling = input.handling;
  if (input.omitHandling) {
    // Pakistani Brands: Wahbayaan's fee is the service-fee line passed in `extraLines`.
  } else if (handling.status === "pending") {
    lines.push({
      key: "handling",
      label: "Wahbayaan handling",
      status: "pending",
      amount: null,
      note: `${PENDING_NOTE} — handling fee not yet set`,
    });
  } else {
    const amount =
      handling.kind === "percent"
        ? applyBps(itemsSubtotal, handling.percentBps)
        : (() => {
            const hfx = fxFor(handling.currency, input);
            return hfx ? convert(handling.amount, hfx, fx) : null;
          })();
    lines.push({
      key: "handling",
      label: "Wahbayaan handling",
      status: amount == null ? "pending" : amount === 0 ? "not_applicable" : "known",
      amount: amount === 0 ? null : amount,
      note: amount == null ? `${PENDING_NOTE} — exchange rate for the handling fee is missing` : amount === 0 ? "No handling fee" : undefined,
    });
  }

  if (input.extraLines?.length) lines.push(...input.extraLines);

  // 6. Gift wrap
  if (input.giftWrap?.selected) {
    const s = input.giftWrap.setting;
    if (s.status === "active") {
      const gfx = fxFor(s.currency, input);
      lines.push({
        key: "gift_wrap",
        label: "Gift wrap",
        status: gfx ? "known" : "pending",
        amount: gfx ? convert(s.amount, gfx, fx) : null,
        note: gfx ? undefined : PENDING_NOTE,
      });
    } else if (s.status === "pending") {
      lines.push({ key: "gift_wrap", label: "Gift wrap", status: "pending", amount: null, note: `${PENDING_NOTE} — gift wrap price not yet set` });
    }
  }

  // 7. Discount
  if (input.discount && input.discount.amount > 0) {
    lines.push({
      key: "discount",
      label: input.discount.label,
      status: "known",
      amount: -Math.min(input.discount.amount, itemsSubtotal),
    });
  }

  const knownTotal = lines.reduce((sum, l) => sum + (l.status === "known" && l.amount != null ? l.amount : 0), 0);
  const pendingLines = lines.filter((l) => l.status === "pending");

  return {
    currency: fx.currency,
    destination: input.destination,
    fx,
    lines,
    knownTotal,
    complete: pendingLines.length === 0,
    pendingLines,
    itemsSubtotal,
    shipments,
    delivery: deliveryEstimate(input.items, shipments),
  };
}
