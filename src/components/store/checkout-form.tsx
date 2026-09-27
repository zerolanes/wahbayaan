"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Gift, Lock, MapPin } from "lucide-react";
import { placeOrderAction } from "@/app/actions/checkout";
import { cn } from "@/lib/utils/cn";

export type SavedAddress = {
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

const control =
  "w-full rounded-xl border bg-white/90 px-3.5 text-[0.95rem] text-umber-900 placeholder:text-umber-400 transition focus:border-gold-500 focus:ring-4 focus:ring-gold-200/50 focus:outline-none";

const REGION_LABEL: Record<string, string> = { US: "State", GB: "County (optional)", CA: "Province" };
const POSTAL_LABEL: Record<string, string> = { US: "ZIP code", GB: "Postcode", CA: "Postal code" };

function F({ id, label, error, hint, children, className }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-umber-800">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-umber-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function CheckoutForm({
  destination,
  destinationName,
  signedIn,
  defaults,
  addresses,
  isGift,
  giftMessage,
  submitLabel,
  providerLabel,
  testMode,
  complete,
}: {
  destination: string;
  destinationName: string;
  signedIn: boolean;
  defaults: { email: string; name: string };
  addresses: SavedAddress[];
  isGift: boolean;
  giftMessage: string | null;
  submitLabel: string;
  providerLabel: string;
  testMode: boolean;
  complete: boolean;
}) {
  const [state, action, pending] = useActionState(placeOrderAction, null);
  const usable = addresses.filter((a) => a.country === destination);
  const [addressId, setAddressId] = useState<string>(usable.find((a) => a.isDefault)?.id ?? usable[0]?.id ?? "new");
  const fe = state?.fieldErrors ?? {};
  const input = (name: string, extra?: string) => cn(control, "h-11", fe[name] ? "border-danger-600" : "border-umber-200", extra);
  const selected = usable.find((a) => a.id === addressId);

  return (
    <form action={action} className="space-y-10" noValidate>
      <input type="hidden" name="country" value={destination} />

      <section aria-labelledby="contact-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="contact-h" className="font-display text-2xl text-umber-900">
            Contact
          </h2>
          {!signedIn ? (
            <p className="text-sm text-umber-600">
              Checking out as a guest ·{" "}
              <Link href="/login?next=/checkout" className="font-medium text-terracotta-600 hover:underline">
                Sign in
              </Link>
            </p>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <F id="email" label="Email" error={fe.email} hint="Order updates and your quote (if any) are sent here.">
            <input id="email" name="email" type="email" autoComplete="email" required defaultValue={defaults.email} className={input("email")} aria-invalid={!!fe.email} />
          </F>
          <F id="customerName" label="Your name" error={fe.customerName}>
            <input id="customerName" name="customerName" autoComplete="name" required defaultValue={defaults.name} className={input("customerName")} aria-invalid={!!fe.customerName} />
          </F>
        </div>
      </section>

      <section aria-labelledby="ship-h">
        <h2 id="ship-h" className="font-display text-2xl text-umber-900">
          {isGift ? "Recipient's delivery address" : "Delivery address"}
        </h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-umber-600">
          <MapPin className="size-4 text-gold-600" aria-hidden /> Shipping to <strong className="font-semibold text-umber-900">{destinationName}</strong> — costs were estimated for
          this country.{" "}
          <Link href="/cart" className="text-terracotta-600 hover:underline">
            Change
          </Link>
        </p>

        {usable.length ? (
          <fieldset className="mt-4 grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Choose a saved address</legend>
            {usable.map((a) => (
              <label key={a.id} className={cn("flex cursor-pointer gap-3 rounded-2xl p-4 text-sm ring-1 transition", addressId === a.id ? "bg-sand-50 ring-2 ring-indigo-900" : "bg-sand-50/60 ring-umber-200 hover:ring-umber-400")}>
                <input type="radio" name="addressId" value={a.id} checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1 size-4 accent-indigo-800" />
                <span>
                  <span className="font-semibold text-umber-900">{a.label ?? a.fullName}</span>
                  <span className="block text-umber-600">
                    {a.fullName}, {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}, {a.city} {a.postalCode}
                  </span>
                </span>
              </label>
            ))}
            <label className={cn("flex cursor-pointer items-center gap-3 rounded-2xl p-4 text-sm ring-1 transition", addressId === "new" ? "bg-sand-50 ring-2 ring-indigo-900" : "bg-sand-50/60 ring-umber-200 hover:ring-umber-400")}>
              <input type="radio" name="addressId" value="new" checked={addressId === "new"} onChange={() => setAddressId("new")} className="size-4 accent-indigo-800" />
              <span className="font-semibold text-umber-900">A different address</span>
            </label>
          </fieldset>
        ) : (
          <input type="hidden" name="addressId" value="new" />
        )}
        {addresses.length > usable.length ? <p className="mt-2 text-xs text-umber-500">Saved addresses outside {destinationName} are hidden.</p> : null}

        <div className={cn("mt-5 grid gap-4 sm:grid-cols-6", addressId !== "new" && "hidden")}>
          <F id="fullName" label="Full name" error={fe.fullName} className="sm:col-span-6">
            <input id="fullName" name="fullName" autoComplete="shipping name" defaultValue={isGift ? "" : defaults.name} className={input("fullName")} />
          </F>
          <F id="line1" label="Street address" error={fe.line1} className="sm:col-span-6">
            <input id="line1" name="line1" autoComplete="shipping address-line1" className={input("line1")} />
          </F>
          <F id="line2" label="Apartment, suite, etc. (optional)" className="sm:col-span-6">
            <input id="line2" name="line2" autoComplete="shipping address-line2" className={input("line2")} />
          </F>
          <F id="city" label="Town or city" error={fe.city} className="sm:col-span-3">
            <input id="city" name="city" autoComplete="shipping address-level2" className={input("city")} />
          </F>
          <F id="region" label={REGION_LABEL[destination] ?? "Region"} className="sm:col-span-3">
            <input id="region" name="region" autoComplete="shipping address-level1" className={input("region")} />
          </F>
          <F id="postalCode" label={POSTAL_LABEL[destination] ?? "Postal code"} error={fe.postalCode} className="sm:col-span-3">
            <input id="postalCode" name="postalCode" autoComplete="shipping postal-code" className={input("postalCode", "uppercase")} />
          </F>
          <F id="countryShown" label="Country" className="sm:col-span-3" hint="Locked to your estimate's destination.">
            <input id="countryShown" value={destinationName} readOnly disabled className={cn(control, "h-11 border-umber-200 bg-sand-100 text-umber-600")} />
          </F>
          {signedIn ? (
            <label className="flex items-center gap-2.5 text-sm text-umber-800 sm:col-span-6">
              <input type="checkbox" name="saveAddress" defaultChecked className="size-4 accent-indigo-800" /> Save this address to my account
            </label>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <F id="phone" label="Phone for the courier" error={fe.phone} hint="International couriers call or text before delivery.">
            <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={selected?.phone ?? ""} className={input("phone")} aria-invalid={!!fe.phone} />
          </F>
        </div>
      </section>

      {isGift ? (
        <section aria-labelledby="gift-h" className="rounded-2xl bg-terracotta-50/70 p-5 ring-1 ring-terracotta-200/70">
          <h2 id="gift-h" className="flex items-center gap-2 font-display text-2xl text-umber-900">
            <Gift className="size-5 text-terracotta-600" aria-hidden /> Gift details
          </h2>
          <p className="mt-1 text-sm text-umber-600">We&apos;ll leave prices off the packing slip. Enter the recipient&apos;s name and address above.</p>
          <F id="giftMessage" label="Gift message" className="mt-4">
            <textarea id="giftMessage" name="giftMessage" rows={3} maxLength={500} defaultValue={giftMessage ?? ""} className={cn(control, "border-umber-200 py-2.5")} />
          </F>
        </section>
      ) : null}

      <section aria-labelledby="notes-h">
        <h2 id="notes-h" className="font-display text-2xl text-umber-900">
          Notes for the artisan <span className="font-sans text-base font-normal text-umber-400">(optional)</span>
        </h2>
        <textarea id="buyerNotes" name="buyerNotes" aria-labelledby="notes-h" rows={3} maxLength={1000} placeholder="Anything they should know — a date you need it by, framing preferences…" className={cn(control, "mt-3 border-umber-200 py-2.5")} />
      </section>

      <div className="space-y-4 border-t border-umber-200/70 pt-8">
        {state?.error ? (
          <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700" role="alert">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-terracotta-600 px-6 text-base font-medium text-white shadow-soft transition hover:bg-terracotta-700 hover:shadow-lift disabled:opacity-60"
        >
          <Lock className="size-4" aria-hidden />
          {pending ? "Placing your order…" : submitLabel}
        </button>
        <div className="flex flex-wrap items-center justify-center gap-2 text-center text-xs text-umber-500">
          {complete ? (
            <span className={cn("rounded-full px-2.5 py-1 font-medium", testMode ? "bg-pending-50 text-pending-600 ring-1 ring-pending-600/20" : "bg-umber-100 text-umber-700")}>
              {providerLabel}
            </span>
          ) : null}
          <span>
            {complete
              ? "Your payment is held by Wahbayaan until your piece arrives."
              : "Nothing is charged now. We'll email you the confirmed total to approve."}{" "}
            By placing your order you agree to our{" "}
            <Link href="/terms" className="underline">
              terms
            </Link>
            .
          </span>
        </div>
      </div>
    </form>
  );
}
