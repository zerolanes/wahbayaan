"use client";

import { useState } from "react";
import { sendQuoteAction } from "@/app/actions/admin/orders";
import { parseMoneyInput, orderMoney } from "@/lib/admin/money";
import { ActionForm, SubmitButton } from "./action-form";
import { FieldRow, TextArea, TextInput, Toggle } from "./controls";

/**
 * Staff quote for an order whose shipping / duty could not be priced
 * automatically. Amounts are typed in the order's currency; the total updates live.
 */
export function QuoteForm({
  orderId,
  currency,
  itemsSubtotal,
  giftWrap,
  discount,
  initial,
  compact,
}: {
  orderId: string;
  currency: string;
  itemsSubtotal: number;
  giftWrap: number;
  discount: number;
  initial?: { shipping?: string; duty?: string; importTax?: string; importTaxNa?: boolean; handling?: string; handlingNone?: boolean; note?: string };
  compact?: boolean;
}) {
  const [v, setV] = useState({
    shipping: initial?.shipping ?? "",
    duty: initial?.duty ?? "",
    importTax: initial?.importTax ?? "",
    handling: initial?.handling ?? "",
    importTaxNa: initial?.importTaxNa ?? false,
    handlingNone: initial?.handlingNone ?? false,
  });
  const n = (s: string) => {
    const x = parseMoneyInput(s);
    return x == null || Number.isNaN(x) ? null : x;
  };
  const parts = [n(v.shipping), n(v.duty), v.importTaxNa ? 0 : n(v.importTax), v.handlingNone ? 0 : n(v.handling)];
  const complete = parts.every((p) => p != null);
  const total = itemsSubtotal + parts.reduce<number>((a, p) => a + (p ?? 0), 0) + giftWrap - discount;
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const grid = compact ? "grid gap-3 sm:grid-cols-4" : "grid gap-3 sm:grid-cols-2";
  return (
    <ActionForm action={sendQuoteAction} inline className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <div className={grid}>
        <FieldRow label={`Shipping (${currency})`} htmlFor={`ship-${orderId}`}>
          <TextInput id={`ship-${orderId}`} name="shipping" inputMode="decimal" placeholder="0.00" value={v.shipping} onChange={set("shipping")} required />
        </FieldRow>
        <FieldRow label={`Import duty (${currency})`} htmlFor={`duty-${orderId}`} hint="0 if none applies">
          <TextInput id={`duty-${orderId}`} name="duty" inputMode="decimal" placeholder="0.00" value={v.duty} onChange={set("duty")} required />
        </FieldRow>
        <FieldRow label={`Import tax (${currency})`} htmlFor={`tax-${orderId}`}>
          <TextInput id={`tax-${orderId}`} name="importTax" inputMode="decimal" placeholder="VAT / GST / sales tax" value={v.importTax} onChange={set("importTax")} disabled={v.importTaxNa} />
          <Toggle name="importTaxNa" label="Not applicable" checked={v.importTaxNa} onChange={set("importTaxNa")} />
        </FieldRow>
        <FieldRow label={`Handling (${currency})`} htmlFor={`hand-${orderId}`}>
          <TextInput id={`hand-${orderId}`} name="handling" inputMode="decimal" placeholder="0.00" value={v.handling} onChange={set("handling")} disabled={v.handlingNone} />
          <Toggle name="handlingNone" label="No handling fee" checked={v.handlingNone} onChange={set("handlingNone")} />
        </FieldRow>
      </div>
      <FieldRow label="Note to the buyer (optional)" htmlFor={`note-${orderId}`}>
        <TextArea id={`note-${orderId}`} name="note" rows={2} className="min-h-16" defaultValue={initial?.note} placeholder="e.g. Two parcels — the rug ships separately by sea-air." />
      </FieldRow>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
        <span>
          Items {orderMoney(itemsSubtotal, currency)}
          {giftWrap ? ` + gift wrap ${orderMoney(giftWrap, currency)}` : ""}
          {discount ? ` − discount ${orderMoney(discount, currency)}` : ""}
        </span>
        <strong className="tabular-nums">{complete ? `Total ${orderMoney(total, currency)}` : "Total — fill every line"}</strong>
      </div>
      <div className="flex justify-end">
        <SubmitButton variant="accent" confirm={`Send this quote to the buyer (${complete ? orderMoney(total, currency) : "incomplete"})?`}>
          Send quote to buyer
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
