"use client";

import { cn } from "@/lib/utils/cn";

/** Contact, delivery address and payment-method fields shared by the brand checkout and the link-request form. */
export type PaymentOption = { id: string; label: string; available: boolean; note: string; test: boolean };

export const control =
  "w-full rounded-xl border bg-white/90 px-3.5 text-[0.95rem] text-umber-900 placeholder:text-umber-400 transition focus:border-gold-500 focus:ring-4 focus:ring-gold-200/50 focus:outline-none";

const REGION: Record<string, string> = { US: "State", GB: "County (optional)", CA: "Province", PK: "Province" };
const POSTAL: Record<string, string> = { US: "ZIP code", GB: "Postcode", CA: "Postal code", PK: "Postal code (optional)" };

export function Row({ id, label, error, hint, className, children }: { id: string; label: string; error?: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-umber-800">
        {label}
      </label>
      {children}
      {error ? <p className="text-sm text-danger-600">{error}</p> : hint ? <p className="text-xs text-umber-500">{hint}</p> : null}
    </div>
  );
}

export function ContactAndAddress({ fe, country, countryName, defaults, gift }: { fe: Record<string, string>; country: string; countryName: string; defaults: { email: string; name: string }; gift: boolean }) {
  const input = (name: string) => cn(control, "h-11", fe[name] ? "border-danger-600" : "border-umber-200");
  return (
    <>
      <section aria-labelledby="contact-h" className="space-y-4">
        <h2 id="contact-h" className="font-display text-2xl text-umber-900">
          Contact
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Row id="email" label="Email" error={fe.email} hint="Order updates and your quote (if any) are sent here.">
            <input id="email" name="email" type="email" autoComplete="email" defaultValue={defaults.email} className={input("email")} />
          </Row>
          <Row id="customerName" label="Your name" error={fe.customerName}>
            <input id="customerName" name="customerName" autoComplete="name" defaultValue={defaults.name} className={input("customerName")} />
          </Row>
        </div>
      </section>
      <section aria-labelledby="ship-h" className="space-y-4">
        <h2 id="ship-h" className="font-display text-2xl text-umber-900">
          {gift ? "Recipient in Pakistan" : "Delivery address"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-6">
          <Row id="fullName" label="Full name" error={fe.fullName} className="sm:col-span-6">
            <input id="fullName" name="fullName" autoComplete="shipping name" defaultValue={gift ? "" : defaults.name} className={input("fullName")} />
          </Row>
          <Row id="line1" label="Street address" error={fe.line1} className="sm:col-span-6">
            <input id="line1" name="line1" autoComplete="shipping address-line1" className={input("line1")} />
          </Row>
          <Row id="line2" label="Apartment, area, landmark (optional)" className="sm:col-span-6">
            <input id="line2" name="line2" autoComplete="shipping address-line2" className={input("line2")} />
          </Row>
          <Row id="city" label="Town or city" error={fe.city} className="sm:col-span-3" hint={country === "PK" ? "Delivery is priced by city zone." : undefined}>
            <input id="city" name="city" autoComplete="shipping address-level2" className={input("city")} />
          </Row>
          <Row id="region" label={REGION[country] ?? "Region"} className="sm:col-span-3">
            <input id="region" name="region" autoComplete="shipping address-level1" className={input("region")} />
          </Row>
          <Row id="postalCode" label={POSTAL[country] ?? "Postal code"} error={fe.postalCode} className="sm:col-span-3">
            <input id="postalCode" name="postalCode" autoComplete="shipping postal-code" className={input("postalCode")} />
          </Row>
          <Row id="countryShown" label="Country" className="sm:col-span-3">
            <input id="countryShown" value={countryName} readOnly disabled className={cn(control, "h-11 border-umber-200 bg-sand-100 text-umber-600")} />
          </Row>
          <Row id="phone" label="Phone for the courier" error={fe.phone} className="sm:col-span-3">
            <input id="phone" name="phone" type="tel" autoComplete="tel" className={input("phone")} />
          </Row>
        </div>
        {gift ? (
          <Row id="giftMessage" label="Gift message (optional)" hint="Printed on a card in the box. Prices are left off the packing slip.">
            <textarea id="giftMessage" name="giftMessage" rows={3} maxLength={500} className={cn(control, "border-umber-200 py-2.5")} />
          </Row>
        ) : null}
      </section>
    </>
  );
}

export function PaymentChoice({ options, error }: { options: PaymentOption[]; error?: string }) {
  const first = options.find((o) => o.available)?.id;
  return (
    <section aria-labelledby="pay-h" className="space-y-3">
      <h2 id="pay-h" className="font-display text-2xl text-umber-900">
        Payment
      </h2>
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="sr-only">Payment method</legend>
        {options.map((o) => (
          <label
            key={o.id}
            className={cn(
              "flex cursor-pointer gap-3 rounded-2xl bg-sand-50/70 p-4 text-sm ring-1 ring-umber-200 has-[:checked]:bg-sand-50 has-[:checked]:ring-2 has-[:checked]:ring-indigo-900",
              !o.available && "cursor-not-allowed opacity-60",
            )}
          >
            <input type="radio" name="method" value={o.id} defaultChecked={o.id === first} disabled={!o.available} className="mt-1 size-4 accent-indigo-800" />
            <span>
              <span className="block font-semibold text-umber-900">{o.label}</span>
              <span className={cn("mt-0.5 block text-xs", o.available ? (o.test ? "text-pending-600" : "text-umber-500") : "text-umber-500")}>{o.note}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
    </section>
  );
}
