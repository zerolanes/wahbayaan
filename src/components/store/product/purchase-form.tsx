"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, Minus, Plus, ShoppingBag } from "lucide-react";
import { addToCartForm } from "@/app/actions/product";
import { cn } from "@/lib/utils/cn";

export type PurchaseOption = {
  id: string;
  label: string;
  kind: "text" | "select";
  choices?: string[];
  required?: boolean;
  maxLength?: number;
  /** Extra cost already converted and formatted in the buyer's currency. */
  extraLabel?: string | null;
};

const control =
  "w-full rounded-xl border border-umber-200 bg-white/90 px-3.5 text-[0.95rem] text-umber-900 placeholder:text-umber-400 transition focus:border-gold-500 focus:ring-4 focus:ring-gold-200/50 focus:outline-none";

/** Customisation, quantity and Add to cart — works as a plain form before hydration. */
export function PurchaseForm({ productId, options, maxQty, showQty, disabledReason }: { productId: string; options: PurchaseOption[]; maxQty: number; showQty: boolean; disabledReason?: string | null }) {
  const [state, action, pending] = useActionState(addToCartForm, null);
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!state?.ok) return;
    setToast(true);
    const t = setTimeout(() => setToast(false), 6000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="productId" value={productId} />
      {options.length ? (
        <fieldset className="space-y-4 rounded-2xl bg-sand-50 p-4 ring-1 ring-umber-200/60">
          <legend className="sr-only">Make it yours</legend>
          <p className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase">Make it yours</p>
          {options.map((o) => (
            <div key={o.id} className="space-y-1.5">
              <label htmlFor={`opt_${o.id}`} className="flex items-baseline justify-between gap-2 text-sm font-medium text-umber-800">
                <span>
                  {o.label}
                  {o.required ? <span className="text-terracotta-600"> *</span> : <span className="font-normal text-umber-400"> (optional)</span>}
                </span>
                {o.extraLabel ? <span className="text-xs font-normal text-umber-500">{o.extraLabel}</span> : null}
              </label>
              {o.kind === "select" ? (
                <select id={`opt_${o.id}`} name={`opt_${o.id}`} required={o.required} defaultValue="" className={cn(control, "h-11")}>
                  <option value="" disabled={o.required}>
                    {o.required ? "Choose…" : "No preference"}
                  </option>
                  {o.choices?.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input id={`opt_${o.id}`} name={`opt_${o.id}`} required={o.required} maxLength={o.maxLength} className={cn(control, "h-11")} autoComplete="off" />
              )}
              {o.kind === "text" && o.maxLength ? <p className="text-xs text-umber-400">Up to {o.maxLength} characters. The artisan confirms spelling with you before starting.</p> : null}
            </div>
          ))}
        </fieldset>
      ) : null}

      <div className="flex gap-3">
        {showQty ? (
          <div className="flex h-13 items-center rounded-full border border-umber-300/70 bg-sand-50/70">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-11 place-items-center rounded-full text-umber-700 hover:text-umber-900 disabled:opacity-40" disabled={qty <= 1} aria-label="Decrease quantity">
              <Minus className="size-4" />
            </button>
            <label htmlFor="qty" className="sr-only">
              Quantity
            </label>
            <input id="qty" name="qty" type="number" min={1} max={maxQty} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))} className="w-10 bg-transparent text-center text-sm font-semibold tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none" />
            <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="grid size-11 place-items-center rounded-full text-umber-700 hover:text-umber-900 disabled:opacity-40" disabled={qty >= maxQty} aria-label="Increase quantity">
              <Plus className="size-4" />
            </button>
          </div>
        ) : (
          <input type="hidden" name="qty" value="1" />
        )}
        <button
          type="submit"
          disabled={pending || !!disabledReason}
          className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-full bg-terracotta-600 px-6 text-base font-medium text-white shadow-soft transition hover:bg-terracotta-700 hover:shadow-lift disabled:pointer-events-none disabled:opacity-50"
        >
          <ShoppingBag className="size-5" aria-hidden />
          {disabledReason ? disabledReason : pending ? "Adding…" : "Add to cart"}
        </button>
      </div>

      <div aria-live="polite">
        {state?.error ? <p className="rounded-xl bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{state.error}</p> : null}
        {state?.ok ? (
          <p className="flex items-center justify-between gap-3 rounded-xl bg-success-50 px-4 py-2.5 text-sm text-success-700">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4" aria-hidden /> {state.message}
            </span>
            <Link href="/cart" className="font-semibold underline underline-offset-4">
              View cart
            </Link>
          </p>
        ) : null}
      </div>

      {toast ? (
        <div role="status" className="fixed inset-x-4 bottom-4 z-[70] mx-auto flex max-w-md animate-fade-up items-center gap-3 rounded-2xl bg-indigo-950 p-4 text-sand-50 shadow-lift sm:right-6 sm:left-auto sm:mx-0">
          <CheckCircle2 className="size-5 shrink-0 text-gold-300" aria-hidden />
          <p className="flex-1 text-sm">Added to your cart. Shipping and import costs are itemised there.</p>
          <Link href="/cart" className="rounded-full bg-gold-400 px-3.5 py-1.5 text-sm font-medium text-ink hover:bg-gold-300">
            View cart
          </Link>
          <button type="button" onClick={() => setToast(false)} className="text-sand-200/60 hover:text-sand-50" aria-label="Dismiss">
            ✕
          </button>
        </div>
      ) : null}
    </form>
  );
}
