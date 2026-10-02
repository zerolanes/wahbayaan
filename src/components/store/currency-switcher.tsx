"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setBuyerPreferences } from "@/app/actions/storefront";
import { BUYER_CURRENCIES, BUYER_DESTINATIONS, CURRENCY_META, type BuyerCurrency, type BuyerDestinationCode } from "@/lib/money/currency";
import { cn } from "@/lib/utils/cn";

/**
 * Persistent "Ship to / Currency" control. Buyers land on their destination's
 * currency (USD/GBP/CAD overseas, PKR in Pakistan); overseas buyers can choose
 * PKR explicitly here.
 */
export function CurrencySwitcher({
  destination,
  currency,
  currencyChosen,
  tone = "dark",
  align = "right",
}: {
  destination: BuyerDestinationCode;
  currency: BuyerCurrency;
  currencyChosen: boolean;
  tone?: "dark" | "light";
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const submit = (data: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(data)) fd.set(k, v);
    start(async () => {
      await setBuyerPreferences(fd);
    });
  };

  const dest = BUYER_DESTINATIONS.find((d) => d.code === destination)!;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Shipping to ${dest.name}, prices in ${currency}. Change`}
        className={cn(
          "flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition",
          tone === "dark" ? "border-current/20 bg-current/[0.03] hover:border-current/40" : "border-white/20 bg-white/10 text-sand-50 hover:bg-white/20",
          pending && "opacity-60",
        )}
      >
        <span aria-hidden>{CURRENCY_META[dest.currency].flag}</span>
        <span className="font-medium">{currency}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden className="opacity-60">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open ? (
        <div
          className={cn(
            "absolute z-50 mt-2 w-80 rounded-2xl border border-umber-200 bg-sand-50 p-4 text-umber-900 shadow-lift",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <p className="text-xs font-semibold tracking-wider text-umber-500 uppercase">Ship to</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {BUYER_DESTINATIONS.map((d) => (
              <button
                key={d.code}
                type="button"
                onClick={() => submit({ destination: d.code })}
                className={cn(
                  "rounded-xl border px-2 py-2 text-center text-sm transition",
                  d.code === destination ? "border-indigo-800 bg-indigo-900 text-sand-50" : "border-umber-200 hover:border-umber-400",
                )}
              >
                <span className="block text-lg" aria-hidden>
                  {CURRENCY_META[d.currency].flag}
                </span>
                {d.code === "GB" ? "UK" : d.code === "US" ? "USA" : d.code === "PK" ? "Pakistan" : "Canada"}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold tracking-wider text-umber-500 uppercase">Show prices in</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {BUYER_CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => submit({ currency: c })}
                className={cn(
                  "rounded-xl border px-2 py-2 text-sm font-medium transition",
                  c === currency ? "border-gold-500 bg-gold-50 text-gold-800" : "border-umber-200 hover:border-umber-400",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-umber-500">
            You&apos;ll be charged in {currency === "PKR" ? "Pakistani rupees" : CURRENCY_META[currency].name + "s"}.{" "}
            {dest.code === "PK" ? "Delivery within Pakistan — no import duty." : `Duty and shipping are estimated for ${dest.name}.`}
            {currencyChosen ? (
              <>
                {" "}
                <button type="button" className="text-terracotta-600 underline" onClick={() => submit({ currency: "auto" })}>
                  Use {dest.currency} for {dest.name}
                </button>
              </>
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
