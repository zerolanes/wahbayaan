"use client";

import { useActionState } from "react";
import { trackOrderAction } from "@/app/actions/track";
import { fieldClass, FormError, FormRow, SubmitButton } from "./form-bits";

export function TrackForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action, pending] = useActionState(trackOrderAction, null);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormRow id="number" label="Order number" hint="It starts with WB- and is in your confirmation email.">
        <input id="number" name="number" defaultValue={state?.values?.number} placeholder="WB-…" autoCapitalize="characters" className={fieldClass(undefined, "uppercase")} />
      </FormRow>
      <FormRow id="email" label="Email used for the order">
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email ?? defaultEmail} className={fieldClass()} />
      </FormRow>
      <FormError message={state?.error} />
      <SubmitButton pending={pending} pendingLabel="Looking…">
        Track order
      </SubmitButton>
    </form>
  );
}
