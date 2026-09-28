"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { changePasswordAction, saveAddressAction, updateProfileAction } from "@/app/actions/account";
import { fieldClass, FormError, FormRow } from "./form-bits";

type Address = {
  id: string;
  label: string | null;
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
  isDefault: boolean;
};

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
];

export function AddressForm({ address, onDone }: { address?: Address; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveAddressAction, null);
  const id = address?.id ?? "new";
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-6">
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      <FormRow id={`label-${id}`} label="Label" optional className="sm:col-span-2">
        <input id={`label-${id}`} name="label" defaultValue={address?.label ?? ""} placeholder="Home, Studio…" className={fieldClass(undefined, "h-11")} />
      </FormRow>
      <FormRow id={`fullName-${id}`} label="Full name" className="sm:col-span-4">
        <input id={`fullName-${id}`} name="fullName" required defaultValue={address?.fullName ?? ""} autoComplete="name" className={fieldClass(undefined, "h-11")} />
      </FormRow>
      <FormRow id={`line1-${id}`} label="Street address" className="sm:col-span-6">
        <input id={`line1-${id}`} name="line1" required defaultValue={address?.line1 ?? ""} autoComplete="address-line1" className={fieldClass(undefined, "h-11")} />
      </FormRow>
      <FormRow id={`line2-${id}`} label="Apartment, suite, etc." optional className="sm:col-span-6">
        <input id={`line2-${id}`} name="line2" defaultValue={address?.line2 ?? ""} autoComplete="address-line2" className={fieldClass(undefined, "h-11")} />
      </FormRow>
      <FormRow id={`city-${id}`} label="Town or city" className="sm:col-span-3">
        <input id={`city-${id}`} name="city" required defaultValue={address?.city ?? ""} autoComplete="address-level2" className={fieldClass(undefined, "h-11")} />
      </FormRow>
      <FormRow id={`region-${id}`} label="State / county / province" optional className="sm:col-span-3">
        <input id={`region-${id}`} name="region" defaultValue={address?.region ?? ""} autoComplete="address-level1" className={fieldClass(undefined, "h-11")} />
      </FormRow>
      <FormRow id={`postalCode-${id}`} label="Postal code" className="sm:col-span-2">
        <input id={`postalCode-${id}`} name="postalCode" required defaultValue={address?.postalCode ?? ""} autoComplete="postal-code" className={fieldClass(undefined, "h-11 uppercase")} />
      </FormRow>
      <FormRow id={`country-${id}`} label="Country" className="sm:col-span-2">
        <select id={`country-${id}`} name="country" defaultValue={address?.country ?? "US"} className={fieldClass(undefined, "h-11")}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow id={`phone-${id}`} label="Phone" optional className="sm:col-span-2">
        <input id={`phone-${id}`} name="phone" type="tel" defaultValue={address?.phone ?? ""} autoComplete="tel" className={fieldClass(undefined, "h-11")} />
      </FormRow>
      <label className="flex items-center gap-2.5 text-sm text-umber-800 sm:col-span-6">
        <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault} className="size-4 accent-indigo-800" /> Use as my default delivery address
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <button disabled={pending} className="h-11 rounded-full bg-indigo-900 px-6 text-sm font-medium text-sand-50 transition hover:bg-indigo-800 disabled:opacity-60">
          {pending ? "Saving…" : address ? "Save changes" : "Add address"}
        </button>
        {onDone ? (
          <button type="button" onClick={onDone} className="text-sm text-umber-600 hover:text-umber-900">
            Cancel
          </button>
        ) : null}
        {state?.ok ? <p className="text-sm text-success-700">{state.message}</p> : null}
      </div>
      <div className="sm:col-span-6">
        <FormError message={state?.error} />
      </div>
    </form>
  );
}

export function ProfileForm({ name, country, marketing }: { name: string; country: string | null; marketing: boolean }) {
  const [state, action, pending] = useActionState(updateProfileAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow id="name" label="Name">
          <input id="name" name="name" required defaultValue={name} autoComplete="name" className={fieldClass(undefined, "h-11")} />
        </FormRow>
        <FormRow id="country" label="Usually shipping to" hint="Sets your default destination and currency.">
          <select id="country" name="country" defaultValue={country ?? ""} className={fieldClass(undefined, "h-11")}>
            <option value="">Not set</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </FormRow>
      </div>
      <label className="flex items-start gap-2.5 text-sm text-umber-800">
        <input type="checkbox" name="marketing" defaultChecked={marketing} className="mt-0.5 size-4 accent-indigo-800" />
        Send me stories from the workshops and early access to limited drops.
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="h-11 rounded-full bg-indigo-900 px-6 text-sm font-medium text-sand-50 transition hover:bg-indigo-800 disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.ok ? <p className="text-sm text-success-700">{state.message}</p> : null}
      </div>
      <FormError message={state?.error} />
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <FormRow id="current" label="Current password">
          <input id="current" name="current" type="password" required autoComplete="current-password" className={fieldClass(undefined, "h-11")} />
        </FormRow>
        <FormRow id="next" label="New password" hint="At least 8 characters.">
          <input id="next" name="next" type="password" required minLength={8} autoComplete="new-password" className={fieldClass(undefined, "h-11")} />
        </FormRow>
        <FormRow id="confirm" label="Repeat new password">
          <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className={fieldClass(undefined, "h-11")} />
        </FormRow>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="h-11 rounded-full border border-umber-300/70 px-6 text-sm font-medium text-umber-900 transition hover:border-umber-900 disabled:opacity-60">
          {pending ? "Changing…" : "Change password"}
        </button>
        {state?.ok ? <p className="text-sm text-success-700">{state.message}</p> : null}
      </div>
      <FormError message={state?.error} />
    </form>
  );
}

export function EditableAddress({ address, children }: { address: Address; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <AddressForm address={address} onDone={() => setEditing(false)} />;
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="text-sm text-umber-800">{children}</div>
      <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-terracotta-600 hover:underline">
        Edit
      </button>
    </div>
  );
}

export function CopyLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex overflow-hidden rounded-full border border-white/20 bg-white/5">
      <input readOnly value={value} aria-label="Your referral link" className="min-w-0 flex-1 bg-transparent px-5 py-3 font-mono text-sm text-sand-50 focus:outline-none" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
        className="flex items-center gap-2 bg-gold-400 px-5 text-sm font-medium text-ink transition hover:bg-gold-300"
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
