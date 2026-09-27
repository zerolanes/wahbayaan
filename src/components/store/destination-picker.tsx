"use client";

import { useTransition } from "react";
import { setBuyerPreferences } from "@/app/actions/storefront";
import { CURRENCY_META, DESTINATIONS, type DestinationCode } from "@/lib/money/currency";
import { cn } from "@/lib/utils/cn";

/** Compact "Ship to" segmented control for product pages and the cart. */
export function DestinationPicker({ destination, className }: { destination: DestinationCode; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <div className={cn("inline-flex rounded-full bg-umber-100/70 p-1", pending && "opacity-60", className)} role="radiogroup" aria-label="Ship to">
      {DESTINATIONS.map((d) => (
        <button
          key={d.code}
          type="button"
          role="radio"
          aria-checked={d.code === destination}
          onClick={() =>
            start(async () => {
              const fd = new FormData();
              fd.set("destination", d.code);
              await setBuyerPreferences(fd);
            })
          }
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition",
            d.code === destination ? "bg-sand-50 text-umber-900 shadow-soft" : "text-umber-600 hover:text-umber-900",
          )}
        >
          <span aria-hidden>{CURRENCY_META[d.currency].flag}</span> {d.code === "GB" ? "UK" : d.code === "US" ? "US" : "Canada"}
        </button>
      ))}
    </div>
  );
}
