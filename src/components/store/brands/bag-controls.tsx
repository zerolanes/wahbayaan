"use client";

import { useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { setBrandShipTo, updateBrandBagLine } from "@/app/actions/brands";
import { cn } from "@/lib/utils/cn";

export function BagQty({ itemId, qty }: { itemId: string; qty: number }) {
  const [pending, start] = useTransition();
  const set = (n: number) =>
    start(async () => {
      const fd = new FormData();
      fd.set("itemId", itemId);
      fd.set("qty", String(n));
      await updateBrandBagLine(fd);
    });
  return (
    <div className={cn("flex items-center gap-2", pending && "opacity-60")}>
      <div className="flex h-9 items-center rounded-full border border-umber-300/70">
        <button type="button" onClick={() => set(qty - 1)} className="grid size-9 place-items-center" aria-label="Decrease quantity">
          <Minus className="size-3.5" />
        </button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
        <button type="button" onClick={() => set(qty + 1)} className="grid size-9 place-items-center" aria-label="Increase quantity">
          <Plus className="size-3.5" />
        </button>
      </div>
      <button type="button" onClick={() => set(0)} className="inline-flex items-center gap-1 text-sm text-umber-500 hover:text-danger-700">
        <Trash2 className="size-4" aria-hidden /> Remove
      </button>
    </div>
  );
}

/** Overseas buyers choose: ship to themselves, or send to an address in Pakistan (e.g. an Eid gift). */
export function ShipToChoice({ homeName, value }: { homeName: string; value: "home" | "PK" }) {
  const [pending, start] = useTransition();
  const pick = (v: "home" | "PK") =>
    start(async () => {
      const fd = new FormData();
      fd.set("shipTo", v);
      await setBrandShipTo(fd);
    });
  const opts = [
    { v: "home" as const, t: `Ship to me in ${homeName}`, d: "International shipping and import costs" },
    { v: "PK" as const, t: "Send to someone in Pakistan", d: "A gift delivered within Pakistan — no import duty, you still pay in your currency" },
  ];
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", pending && "opacity-60")} role="radiogroup" aria-label="Where should we deliver?">
      {opts.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => pick(o.v)} className={cn("rounded-2xl p-4 text-left text-sm ring-1 transition", value === o.v ? "bg-sand-50 ring-2 ring-indigo-900" : "bg-sand-50/60 ring-umber-200 hover:ring-umber-400")}>
          <span className="block font-semibold text-umber-900">{o.t}</span>
          <span className="text-umber-600">{o.d}</span>
        </button>
      ))}
    </div>
  );
}
