"use client";

import { useState } from "react";
import { sellerBookCourierAction, sellerHandOverAction, sellerSendToHubAction } from "@/app/actions/seller";
import { Field, Input, Radio, Select } from "@/components/ui/form";
import { ActionForm, SubmitButton } from "./action-form";

/**
 * Seller fulfilment forms (no money shown — the seller dashboard is PKR-only
 * and these steps don't involve amounts).
 */

/** Domestic order: Book courier → print label → hand over. */
export function BookCourierForm({ vendorOrderId, couriers, bookable }: { vendorOrderId: string; couriers: string[]; bookable: string[] }) {
  const [courier, setCourier] = useState(couriers.find((c) => bookable.includes(c)) ?? couriers[0] ?? "");
  const canBook = bookable.includes(courier);
  const [method, setMethod] = useState<"book" | "manual">(canBook ? "book" : "manual");
  const effective = canBook ? method : "manual";
  return (
    <ActionForm action={sellerBookCourierAction} className="rounded-2xl bg-sand-100/70 p-4">
      <input type="hidden" name="vendorOrderId" value={vendorOrderId} />
      <input type="hidden" name="method" value={effective} />
      <p className="font-medium text-umber-900">1. Book a courier</p>
      <Field label="Courier" htmlFor={`bc-${vendorOrderId}`}>
        <Select id={`bc-${vendorOrderId}`} name="courier" required value={courier} onChange={(e) => setCourier(e.target.value)}>
          {couriers.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>
      {canBook ? (
        <div className="space-y-2" role="radiogroup" aria-label="Booking">
          <Radio name="bookingChoice" value="book" checked={method === "book"} onChange={() => setMethod("book")} label="Book it for me" />
          <Radio name="bookingChoice" value="manual" checked={method === "manual"} onChange={() => setMethod("manual")} label="I booked it myself" />
        </div>
      ) : null}
      {effective === "manual" ? (
        <Field label="Tracking number" htmlFor={`bt-${vendorOrderId}`} hint="From the courier's receipt">
          <Input id={`bt-${vendorOrderId}`} name="trackingNumber" required />
        </Field>
      ) : null}
      <SubmitButton className="w-full" pendingLabel="Booking…">
        {effective === "book" ? "Book courier" : "Save booking"}
      </SubmitButton>
    </ActionForm>
  );
}

export function HandOverForm({ shipmentId }: { shipmentId: string }) {
  return (
    <ActionForm action={sellerHandOverAction}>
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <SubmitButton className="w-full" pendingLabel="Saving…">
        Handed over to the courier
      </SubmitButton>
    </ActionForm>
  );
}

/** International order: send the parcel to the Wahbayaan hub. */
export function SendToHubForm({ vendorOrderId, couriers, bookable }: { vendorOrderId: string; couriers: string[]; bookable: string[] }) {
  const [method, setMethod] = useState<"book" | "manual" | "drop_off">(bookable.length ? "book" : couriers.length ? "manual" : "drop_off");
  const [courier, setCourier] = useState(bookable[0] ?? couriers[0] ?? "");
  return (
    <ActionForm action={sellerSendToHubAction} className="rounded-2xl bg-sand-100/70 p-4">
      <input type="hidden" name="vendorOrderId" value={vendorOrderId} />
      <input type="hidden" name="method" value={method} />
      <p className="font-medium text-umber-900">Send it to the hub</p>
      <div className="space-y-2" role="radiogroup" aria-label="How it reaches the hub">
        {bookable.length ? <Radio name="hubChoice" value="book" checked={method === "book"} onChange={() => setMethod("book")} label="Wahbayaan books the courier" /> : null}
        {couriers.length ? <Radio name="hubChoice" value="manual" checked={method === "manual"} onChange={() => setMethod("manual")} label="I booked a courier" /> : null}
        <Radio name="hubChoice" value="drop_off" checked={method === "drop_off"} onChange={() => setMethod("drop_off")} label="I'll drop it off at the hub" />
      </div>
      {method !== "drop_off" ? (
        <Field label="Courier" htmlFor={`hc-${vendorOrderId}`}>
          <Select id={`hc-${vendorOrderId}`} name="courier" required value={courier} onChange={(e) => setCourier(e.target.value)}>
            {(method === "book" ? bookable : couriers).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      ) : null}
      {method === "manual" ? (
        <Field label="Tracking number" htmlFor={`ht-${vendorOrderId}`}>
          <Input id={`ht-${vendorOrderId}`} name="trackingNumber" required />
        </Field>
      ) : null}
      <SubmitButton className="w-full" pendingLabel="Saving…">
        {method === "book" ? "Book courier to hub" : method === "manual" ? "Mark sent to hub" : "I'll drop it off"}
      </SubmitButton>
    </ActionForm>
  );
}
