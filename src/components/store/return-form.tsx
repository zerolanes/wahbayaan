"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { requestReturnAction } from "@/app/actions/fulfilment";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

/** Request a return from the order page (inside the protection window). */
export function ReturnRequestForm({ orderNumber, items }: { orderNumber: string; items: { id: string; title: string; qty: number }[] }) {
  const [state, action, pending] = useActionState(requestReturnAction, null);
  if (state?.ok)
    return (
      <p className="flex items-center gap-2 rounded-xl bg-success-50 px-4 py-2.5 text-sm text-success-700" role="status">
        <CheckCircle2 className="size-4" aria-hidden /> {state.message}
      </p>
    );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="order" value={orderNumber} />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-umber-800">What would you like to return?</legend>
        {items.map((i) => (
          <Checkbox key={i.id} name="items" value={i.id} defaultChecked={items.length === 1} label={`${i.title}${i.qty > 1 ? ` (×${i.qty})` : ""}`} />
        ))}
      </fieldset>
      <Field label="Reason" htmlFor="return-reason">
        <Select id="return-reason" name="reason" defaultValue="damaged">
          <option value="damaged">Arrived damaged</option>
          <option value="not_as_described">Not as described</option>
          <option value="wrong_item">Wrong item</option>
          <option value="changed_mind">Changed my mind</option>
          <option value="other">Something else</option>
        </Select>
      </Field>
      <Field label="Tell us more" htmlFor="return-description">
        <Textarea id="return-description" name="description" required minLength={10} rows={3} />
      </Field>
      <Field label="Photos (optional)" htmlFor="return-photos">
        <input id="return-photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="text-sm" />
      </Field>
      {state?.error ? (
        <p className="rounded-xl bg-danger-50 px-4 py-2.5 text-sm text-danger-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Request return"}
      </Button>
    </form>
  );
}
