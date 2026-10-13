"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitBrandSellerApplication } from "@/app/actions/brand-seller";
import { fieldClass, FormError, FormRow, SubmitButton, SuccessPanel } from "@/components/store/form-bits";

const AUDIENCES = [
  { id: "women", label: "Women" },
  { id: "men", label: "Men" },
  { id: "kids", label: "Kids" },
  { id: "unisex", label: "Unisex" },
];

/** "Sell your brand on Wahbayaan" application, with the seller terms acceptance. */
export function BrandJoinForm({ signedIn, defaults, termsVersion }: { signedIn: boolean; defaults: { name: string; email: string }; termsVersion: string }) {
  const [state, action, pending] = useActionState(submitBrandSellerApplication, null);
  const fe = state?.fieldErrors ?? {};
  if (state?.ok)
    return (
      <SuccessPanel title="Application received">
        Thank you — we&apos;ll review {state.message} and email you within a few working days. Once approved, sign in to open your brand portal.
      </SuccessPanel>
    );
  return (
    <form action={action} className="space-y-10" noValidate>
      <input type="hidden" name="termsVersion" value={termsVersion} />
      <FormError message={state?.error} />
      <fieldset className="space-y-5">
        <legend className="font-display text-2xl text-umber-900">Your brand</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormRow id="brandName" label="Brand name" error={fe.brandName}>
            <input id="brandName" name="brandName" className={fieldClass(fe.brandName)} />
          </FormRow>
          <FormRow id="city" label="City" error={fe.city}>
            <input id="city" name="city" placeholder="e.g. Lahore" className={fieldClass(fe.city)} />
          </FormRow>
          <FormRow id="websiteUrl" label="Website" optional error={fe.websiteUrl}>
            <input id="websiteUrl" name="websiteUrl" type="url" placeholder="https://" className={fieldClass(fe.websiteUrl)} />
          </FormRow>
          <FormRow id="instagram" label="Instagram" optional error={fe.instagram}>
            <input id="instagram" name="instagram" placeholder="@yourbrand" className={fieldClass(fe.instagram)} />
          </FormRow>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-umber-800" id="aud-label">
            Who you design for
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2" role="group" aria-labelledby="aud-label">
            {AUDIENCES.map((a) => (
              <label key={a.id} className="inline-flex min-h-10 items-center gap-2 text-umber-800">
                <input type="checkbox" name="audiences" value={a.id} className="size-4 accent-indigo-900" /> {a.label}
              </label>
            ))}
          </div>
          {fe.audiences ? <p className="text-sm text-danger-600">{fe.audiences}</p> : null}
        </div>
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <FormRow id="productTypes" label="What you sell" error={fe.productTypes}>
            <input id="productTypes" name="productTypes" placeholder="e.g. Lawn, pret, formals" className={fieldClass(fe.productTypes)} />
          </FormRow>
          <FormRow id="catalogueSize" label="Products" optional>
            <select id="catalogueSize" name="catalogueSize" defaultValue="" className={fieldClass(undefined, "h-11")}>
              <option value="">Choose…</option>
              <option value="1-20">1–20</option>
              <option value="21-100">21–100</option>
              <option value="101-500">101–500</option>
              <option value="500+">500+</option>
            </select>
          </FormRow>
        </div>
        <FormRow id="about" label="About the brand" error={fe.about} hint="A few lines: what you make, since when, where it's made.">
          <textarea id="about" name="about" rows={4} className={fieldClass(fe.about)} />
        </FormRow>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-display text-2xl text-umber-900">You</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormRow id="contactName" label="Full name" error={fe.contactName}>
            <input id="contactName" name="contactName" defaultValue={defaults.name} autoComplete="name" className={fieldClass(fe.contactName)} />
          </FormRow>
          <FormRow id="contactRole" label="Your role" optional>
            <input id="contactRole" name="contactRole" placeholder="Founder, designer…" className={fieldClass()} />
          </FormRow>
          <FormRow id="email" label="Email" error={fe.email}>
            <input id="email" name="email" type="email" defaultValue={defaults.email} autoComplete="email" className={fieldClass(fe.email)} />
          </FormRow>
          <FormRow id="phone" label="Phone or WhatsApp" error={fe.phone}>
            <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+92 3…" className={fieldClass(fe.phone)} />
          </FormRow>
          {!signedIn ? (
            <FormRow id="password" label="Choose a password" error={fe.password} hint={<>For your brand account. Already registered? <Link href="/login?next=/brands/join" className="underline">Sign in</Link>.</>}>
              <input id="password" name="password" type="password" autoComplete="new-password" className={fieldClass(fe.password)} />
            </FormRow>
          ) : null}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label className="flex items-start gap-3 text-umber-800">
          <input type="checkbox" name="terms" className="mt-1 size-4 shrink-0 accent-indigo-900" aria-describedby="terms-note" />
          <span>
            I accept the <Link href="/brands/join/terms" target="_blank" className="font-medium underline">brand seller terms</Link> on behalf of this brand, and confirm we own or may use every logo, photo and description we upload.
          </span>
        </label>
        <p id="terms-note" className="pl-7 text-xs text-umber-500">
          We record your name, email, the date and the terms version ({termsVersion}).
        </p>
        {fe.terms ? <p className="pl-7 text-sm text-danger-600">{fe.terms}</p> : null}
      </div>

      <SubmitButton pending={pending} pendingLabel="Sending…">
        Apply to sell
      </SubmitButton>
    </form>
  );
}
