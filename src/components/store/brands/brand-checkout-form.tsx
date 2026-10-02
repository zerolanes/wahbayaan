"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { placeBrandOrderAction } from "@/app/actions/brands";
import { control, ContactAndAddress, PaymentChoice, type PaymentOption } from "./checkout-fields";
import { cn } from "@/lib/utils/cn";

export function BrandCheckoutForm({
  country,
  countryName,
  gift,
  defaults,
  payment,
  submitLabel,
  complete,
}: {
  country: string;
  countryName: string;
  gift: boolean;
  defaults: { email: string; name: string };
  payment: PaymentOption[];
  submitLabel: string;
  complete: boolean;
}) {
  const [state, action, pending] = useActionState(placeBrandOrderAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-10" noValidate>
      <ContactAndAddress fe={fe} country={country} countryName={countryName} defaults={defaults} gift={gift} />
      <PaymentChoice options={payment} error={fe.method} />
      <section className="space-y-2">
        <label htmlFor="buyerNotes" className="block text-sm font-medium text-umber-800">
          Notes for our team <span className="font-normal text-umber-400">(optional)</span>
        </label>
        <textarea id="buyerNotes" name="buyerNotes" rows={3} maxLength={1000} className={cn(control, "border-umber-200 py-2.5")} placeholder="A date you need it by, a second size choice…" />
      </section>
      <div className="space-y-4 border-t border-umber-200/70 pt-8">
        {state?.error ? (
          <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700" role="alert">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || !payment.some((p) => p.available)}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-terracotta-600 px-6 text-base font-medium text-white shadow-soft transition hover:bg-terracotta-700 disabled:opacity-60"
        >
          <Lock className="size-4" aria-hidden />
          {pending ? "Placing your order…" : submitLabel}
        </button>
        <p className="text-center text-xs text-umber-500">
          {complete ? "You'll pay on the next step." : "Nothing is charged now — we'll email you the confirmed total to approve."} We order from the brand once you&apos;ve paid.
        </p>
      </div>
    </form>
  );
}
