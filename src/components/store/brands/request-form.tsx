"use client";

import { useActionState, useState } from "react";
import { Link2, Plus, Send, Trash2 } from "lucide-react";
import { createBrandRequestAction } from "@/app/actions/brands";
import { cn } from "@/lib/utils/cn";
import { control, ContactAndAddress, PaymentChoice, Row, type PaymentOption } from "./checkout-fields";

function domainOf(url: string) {
  try {
    const u = new URL(/^[a-z]+:/i.test(url) ? url : `https://${url}`);
    return /^https?:$/.test(u.protocol) && u.hostname.includes(".") ? u.hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

/** "Shop any Pakistani brand by link": several items from different brands in one box. Links are never opened or previewed here. */
export function BrandRequestForm({
  home,
  canChoose,
  defaults,
  payment,
  maxItems,
  prefillBrand,
}: {
  /** The buyer's own destination (code + name); `PK` for buyers in Pakistan. */
  home: { code: string; name: string };
  canChoose: boolean;
  defaults: { email: string; name: string };
  payment: PaymentOption[];
  maxItems: number;
  prefillBrand?: string;
}) {
  const [state, action, pending] = useActionState(createBrandRequestAction, null);
  const [rows, setRows] = useState<number[]>([0]);
  const [next, setNext] = useState(1);
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [shipTo, setShipTo] = useState<"home" | "PK">(canChoose ? "home" : "PK");
  const fe = state?.fieldErrors ?? {};
  const country = shipTo === "PK" ? { code: "PK", name: "Pakistan" } : home;
  const input = (name: string, extra?: string) => cn(control, "h-11", fe[name] ? "border-danger-600" : "border-umber-200", extra);

  return (
    <form action={action} className="space-y-10" noValidate>
      <section aria-labelledby="items-h" className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="items-h" className="font-display text-2xl text-umber-900">
            What should we buy?
          </h2>
          <span className="text-sm text-umber-500">
            {rows.length} of {maxItems} · one box
          </span>
        </div>
        {rows.map((key, i) => {
          const domain = urls[key] ? domainOf(urls[key]) : null;
          return (
            <fieldset key={key} className="space-y-4 rounded-2xl bg-sand-50 p-4 ring-1 ring-umber-200/60 sm:p-5">
              <legend className="sr-only">Item {i + 1}</legend>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase">Item {i + 1}</p>
                {rows.length > 1 ? (
                  <button type="button" onClick={() => setRows(rows.filter((r) => r !== key))} className="inline-flex items-center gap-1 text-sm text-umber-500 hover:text-danger-700">
                    <Trash2 className="size-4" aria-hidden /> Remove
                  </button>
                ) : null}
              </div>
              <Row id={`url-${key}`} label="Product link" error={fe[`items.${i}.url`]} hint={domain ? `From ${domain}` : "Copy the address of the product page from the brand's website."}>
                <div className="relative">
                  <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-umber-400" aria-hidden />
                  <input
                    id={`url-${key}`}
                    name={`items.${i}.url`}
                    inputMode="url"
                    placeholder="https://"
                    value={urls[key] ?? ""}
                    onChange={(e) => setUrls({ ...urls, [key]: e.target.value })}
                    className={input(`items.${i}.url`, "pl-9")}
                  />
                </div>
              </Row>
              <div className="grid gap-4 sm:grid-cols-2">
                <Row id={`name-${key}`} label="Product name as shown" error={fe[`items.${i}.productName`]}>
                  <input id={`name-${key}`} name={`items.${i}.productName`} className={input(`items.${i}.productName`)} />
                </Row>
                <Row id={`brand-${key}`} label="Brand (optional)">
                  <input id={`brand-${key}`} name={`items.${i}.brandName`} defaultValue={i === 0 ? prefillBrand : undefined} className={input(`items.${i}.brandName`)} />
                </Row>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Row id={`size-${key}`} label="Size">
                  <input id={`size-${key}`} name={`items.${i}.size`} placeholder="e.g. M" className={input(`items.${i}.size`)} />
                </Row>
                <Row id={`colour-${key}`} label="Colour">
                  <input id={`colour-${key}`} name={`items.${i}.colour`} className={input(`items.${i}.colour`)} />
                </Row>
                <Row id={`qty-${key}`} label="Quantity" error={fe[`items.${i}.qty`]}>
                  <input id={`qty-${key}`} name={`items.${i}.qty`} type="number" min={1} max={20} defaultValue={1} className={input(`items.${i}.qty`)} />
                </Row>
              </div>
              <Row id={`notes-${key}`} label="Notes (optional)">
                <input id={`notes-${key}`} name={`items.${i}.notes`} placeholder="Second choice of size, stitched or unstitched…" className={input(`items.${i}.notes`)} />
              </Row>
            </fieldset>
          );
        })}
        {rows.length < maxItems ? (
          <button
            type="button"
            onClick={() => {
              setRows([...rows, next]);
              setNext(next + 1);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-umber-300/70 px-4 py-2 text-sm font-medium text-umber-900 hover:border-umber-900"
          >
            <Plus className="size-4" aria-hidden /> Add another item
          </button>
        ) : null}
      </section>

      <section aria-labelledby="where-h" className="space-y-3">
        <h2 id="where-h" className="font-display text-2xl text-umber-900">
          Where does it go?
        </h2>
        {canChoose ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { v: "home" as const, t: `To me in ${home.name}`, d: "International shipping; import costs are confirmed in your quote." },
              { v: "PK" as const, t: "To an address in Pakistan", d: "A gift for family or friends — delivered within Pakistan, no import duty." },
            ].map((o) => (
              <label key={o.v} className={cn("flex cursor-pointer gap-3 rounded-2xl p-4 text-sm ring-1", shipTo === o.v ? "bg-sand-50 ring-2 ring-indigo-900" : "bg-sand-50/60 ring-umber-200")}>
                <input type="radio" name="shipTo" value={o.v} checked={shipTo === o.v} onChange={() => setShipTo(o.v)} className="mt-1 size-4 accent-indigo-800" />
                <span>
                  <span className="block font-semibold text-umber-900">{o.t}</span>
                  <span className="text-umber-600">{o.d}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <>
            <input type="hidden" name="shipTo" value="PK" />
            <p className="text-sm text-umber-600">Delivered within Pakistan.</p>
          </>
        )}
      </section>

      <ContactAndAddress fe={fe} country={country.code} countryName={country.name} defaults={defaults} gift={shipTo === "PK" && canChoose} />
      <PaymentChoice options={payment} error={fe.method} />
      <section className="space-y-2">
        <label htmlFor="buyerNotes" className="block text-sm font-medium text-umber-800">
          Anything else? <span className="font-normal text-umber-400">(optional)</span>
        </label>
        <textarea id="buyerNotes" name="buyerNotes" rows={3} maxLength={1000} className={cn(control, "border-umber-200 py-2.5")} />
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
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-terracotta-600 px-6 text-base font-medium text-white shadow-soft transition hover:bg-terracotta-700 disabled:opacity-60"
        >
          <Send className="size-4" aria-hidden />
          {pending ? "Sending…" : "Send request — get a quote"}
        </button>
        <p className="text-center text-xs text-umber-500">Nothing is charged now. We check each item and price, then email you a quote to approve.</p>
      </div>
    </form>
  );
}
