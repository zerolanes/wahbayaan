"use client";

import { sellerOrderAction } from "@/app/actions/seller";
import { Field, Input, Select } from "@/components/ui/form";
import { ActionForm, SubmitButton } from "./action-form";

const COURIERS = ["DHL Express", "FedEx International", "Aramex", "UPS", "TCS International", "Leopards International", "Other"];

/** The next step an artisan can take on a parcel. */
export function OrderActions({ vendorOrderId, status, orderPaid, disputed }: { vendorOrderId: string; status: string; orderPaid: boolean; disputed?: boolean }) {
  if (!orderPaid) return <p className="text-umber-500 text-sm">Waiting for the buyer&apos;s payment — nothing to do yet.</p>;
  // Fulfilment actions are refused while a case is open (see vendorOrderAction).
  if (disputed)
    return <p className="text-umber-600 text-sm">The buyer opened a case. Your payout is on hold until our team resolves it — reply if they message you.</p>;
  if (status === "shipped") return <p className="text-umber-600 text-sm">Shipped — delivery is confirmed by the courier or our team.</p>;
  if (status === "delivered")
    return <p className="text-success-700 text-sm">Delivered. Your payout is released when the buyer confirms or the protection window ends.</p>;
  if (status === "cancelled") return <p className="text-umber-500 text-sm">This order was cancelled.</p>;

  const simple = (type: string, label: string, hint: string, variant: "primary" | "outline" = "primary") => (
    <ActionForm action={sellerOrderAction}>
      <>
        <input type="hidden" name="vendorOrderId" value={vendorOrderId} />
        <input type="hidden" name="type" value={type} />
        <SubmitButton variant={variant} className="w-full" pendingLabel="Saving…">
          {label}
        </SubmitButton>
        <p className="text-umber-500 text-xs">{hint}</p>
      </>
    </ActionForm>
  );

  return (
    <div className="space-y-5">
      {status === "pending" ? simple("accept", "Accept order", "Confirms to the buyer that you're on it.") : null}
      {status === "accepted" ? simple("start_production", "Start making", "Lets the buyer know work has begun.", "outline") : null}
      {status === "accepted" || status === "in_production"
        ? simple("ready", "Mark finished & ready to pack", "Our team will confirm courier booking.", "outline")
        : null}
      {["accepted", "in_production", "ready_to_ship"].includes(status) ? (
        <ActionForm action={sellerOrderAction} className="bg-sand-100/70 rounded-2xl p-4">
          <>
            <input type="hidden" name="vendorOrderId" value={vendorOrderId} />
            <input type="hidden" name="type" value="ship" />
            <p className="text-umber-900 font-medium">Hand over to the courier</p>
            <Field label="Courier" htmlFor={`courier-${vendorOrderId}`}>
              <Select id={`courier-${vendorOrderId}`} name="courier" required defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {COURIERS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Tracking number" htmlFor={`trk-${vendorOrderId}`}>
              <Input id={`trk-${vendorOrderId}`} name="trackingNumber" required />
            </Field>
            <Field label="Tracking link (optional)" htmlFor={`url-${vendorOrderId}`}>
              <Input id={`url-${vendorOrderId}`} name="trackingUrl" type="url" placeholder="https://" />
            </Field>
            <Field label="Packed weight (kg)" htmlFor={`kg-${vendorOrderId}`} hint="From the courier's receipt.">
              <Input id={`kg-${vendorOrderId}`} name="packageWeightKg" inputMode="decimal" />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Saving…">
              Mark as shipped
            </SubmitButton>
          </>
        </ActionForm>
      ) : null}
    </div>
  );
}
