"use client";

import { useState } from "react";
import { packShipAction } from "@/app/actions/admin/fulfilment";
import { chargeableWeightG, volumetricWeightG } from "@/lib/fulfilment/consolidation";
import { ActionForm, SubmitButton } from "./action-form";
import { FieldRow, SelectInput, TextInput, Toggle } from "./controls";

type Parcel = { id: string; reference: string; senderLabel: string; itemCount: number; status: string; bin: string | null };

/** Pack & ship: choose the checked parcels, weigh and measure the box, book the courier. */
export function PackForm({ orderId, parcels, couriers, divisor, bookable }: { orderId: string; parcels: Parcel[]; couriers: string[]; divisor: number; bookable: string[] }) {
  const [box, setBox] = useState({ kg: "", l: "", w: "", h: "" });
  const [courier, setCourier] = useState(couriers[0] ?? "");
  const [method, setMethod] = useState<"book" | "manual">(bookable.includes(couriers[0] ?? "") ? "book" : "manual");
  const n = (s: string) => (Number.isFinite(Number(s)) && Number(s) > 0 ? Number(s) : null);
  const actual = n(box.kg) != null ? Math.round(n(box.kg)! * 1000) : null;
  const vol = n(box.l) && n(box.w) && n(box.h) ? volumetricWeightG(n(box.l)!, n(box.w)!, n(box.h)!, divisor) : null;
  const charge = actual != null && vol != null ? chargeableWeightG(actual, vol) : null;
  const kg = (g: number | null) => (g == null ? "—" : `${(g / 1000).toFixed(2)} kg`);
  const set = (k: keyof typeof box) => (e: React.ChangeEvent<HTMLInputElement>) => setBox((b) => ({ ...b, [k]: e.target.value }));
  return (
    <ActionForm action={packShipAction} inline className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium tracking-wide text-umber-600">Parcels in this box</legend>
        {parcels.map((p) => (
          <Toggle
            key={p.id}
            name="parcelIds[]"
            value={p.id}
            defaultChecked={p.status === "qc_passed"}
            disabled={p.status !== "qc_passed"}
            label={
              <>
                <span className="font-mono text-xs">{p.reference}</span> · {p.senderLabel} · {p.itemCount} item{p.itemCount === 1 ? "" : "s"}
                {p.bin ? ` · bin ${p.bin}` : ""}
                {p.status !== "qc_passed" ? <span className="text-umber-500"> — {p.status.replace("_", " ")}</span> : null}
              </>
            }
          />
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-4">
        <FieldRow label="Packed weight (kg)" htmlFor="pk-kg">
          <TextInput id="pk-kg" name="weightKg" inputMode="decimal" required value={box.kg} onChange={set("kg")} />
        </FieldRow>
        <FieldRow label="Length (cm)" htmlFor="pk-l">
          <TextInput id="pk-l" name="lengthCm" inputMode="decimal" required value={box.l} onChange={set("l")} />
        </FieldRow>
        <FieldRow label="Width (cm)" htmlFor="pk-w">
          <TextInput id="pk-w" name="widthCm" inputMode="decimal" required value={box.w} onChange={set("w")} />
        </FieldRow>
        <FieldRow label="Height (cm)" htmlFor="pk-h">
          <TextInput id="pk-h" name="heightCm" inputMode="decimal" required value={box.h} onChange={set("h")} />
        </FieldRow>
      </div>
      <p className="rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-900" aria-live="polite">
        Actual {kg(actual)} · volumetric {kg(vol)} (÷{divisor}) · <strong>chargeable {kg(charge)}</strong>
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldRow label="Courier" htmlFor="pk-courier">
          <SelectInput
            id="pk-courier"
            name="courierName"
            value={courier}
            onChange={(e) => {
              setCourier(e.target.value);
              setMethod(bookable.includes(e.target.value) ? "book" : "manual");
            }}
          >
            {couriers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </SelectInput>
        </FieldRow>
        <FieldRow label="Service (optional)" htmlFor="pk-svc">
          <TextInput id="pk-svc" name="serviceName" placeholder="e.g. Express" />
        </FieldRow>
        <FieldRow label="Booking" htmlFor="pk-method">
          <SelectInput id="pk-method" name="method" value={method} onChange={(e) => setMethod(e.target.value as "book" | "manual")}>
            <option value="book" disabled={!bookable.includes(courier)}>
              Book through the courier integration{bookable.includes(courier) ? "" : " (not set up)"}
            </option>
            <option value="manual">Booked by us — enter the tracking number</option>
          </SelectInput>
        </FieldRow>
      </div>
      {method === "manual" ? (
        <FieldRow label="Tracking number" htmlFor="pk-trk">
          <TextInput id="pk-trk" name="trackingNumber" required />
        </FieldRow>
      ) : null}
      <FieldRow label="Notes (internal)" htmlFor="pk-notes">
        <TextInput id="pk-notes" name="notes" />
      </FieldRow>
      <SubmitButton variant="accent" confirm="Ship this box? The buyer gets the tracking number by email.">
        Ship box
      </SubmitButton>
    </ActionForm>
  );
}
