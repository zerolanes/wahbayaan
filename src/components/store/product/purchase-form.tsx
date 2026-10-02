"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Minus, Plus, ShoppingBag } from "lucide-react";
import { addToCartForm } from "@/app/actions/product";
import { Toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import { CART_ADDED_EVENT } from "../mini-cart";

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
  "w-full rounded-[var(--radius-control)] border border-umber-200 bg-white px-3.5 text-base text-umber-900 placeholder:text-umber-500 transition focus:border-gold-500 focus:ring-4 focus:ring-gold-200/50 focus:outline-none sm:text-[0.95rem]";

/**
 * Customisation, quantity and Add to cart — works as a plain form before hydration.
 * On phones a compact glass buy bar (price + Add to cart) docks above the tab bar
 * once the main button scrolls out of view; it submits this same form, so
 * required options are still validated. After adding, desktops open the
 * mini-cart and phones show a toast.
 */
export function PurchaseForm({
  productId,
  options,
  maxQty,
  showQty,
  disabledReason,
  priceSlot,
  title,
}: {
  productId: string;
  options: PurchaseOption[];
  maxQty: number;
  showQty: boolean;
  disabledReason?: string | null;
  /** Server-rendered price shown in the phone buy bar. */
  priceSlot?: ReactNode;
  title?: string;
}) {
  const [state, action, pending] = useActionState(addToCartForm, null);
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState(false);
  const [bar, setBar] = useState(false);
  const mainButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!state?.ok) return;
    window.dispatchEvent(new CustomEvent(CART_ADDED_EVENT));
    if (window.matchMedia("(min-width: 768px)").matches) return;
    setToast(true);
    const t = setTimeout(() => setToast(false), 6000);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    const el = mainButton.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="productId" value={productId} />
      {options.length ? (
        <fieldset className="space-y-4 rounded-[var(--radius-card)] bg-white p-4 shadow-[0_0_0_0.5px_rgb(34_26_19/0.1)]">
          <legend className="sr-only">Make it yours</legend>
          <p className="text-xs font-semibold tracking-[0.06em] text-gold-700 uppercase">Make it yours</p>
          {options.map((o) => (
            <div key={o.id} className="space-y-1.5">
              <label htmlFor={`opt_${o.id}`} className="flex items-baseline justify-between gap-2 text-sm font-medium text-umber-800">
                <span>
                  {o.label}
                  {o.required ? <span className="text-terracotta-600"> *</span> : <span className="font-normal text-umber-600"> (optional)</span>}
                </span>
                {o.extraLabel ? <span className="text-xs font-normal text-umber-600">{o.extraLabel}</span> : null}
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
              {o.kind === "text" && o.maxLength ? <p className="text-xs text-umber-600">Up to {o.maxLength} characters. The artisan confirms spelling with you before starting.</p> : null}
            </div>
          ))}
        </fieldset>
      ) : null}

      <div className="flex gap-3">
        {showQty ? (
          <div className="flex h-13 items-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgb(34_26_19/0.16)]">
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
          ref={mainButton}
          type="submit"
          disabled={pending || !!disabledReason}
          className="pressable inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-full bg-terracotta-600 px-6 text-base font-medium text-white shadow-soft hover:bg-terracotta-700 disabled:pointer-events-none disabled:opacity-50"
        >
          <ShoppingBag className="size-5" aria-hidden />
          {disabledReason ? disabledReason : pending ? "Adding…" : "Add to cart"}
        </button>
      </div>

      <div aria-live="polite">
        {state?.error ? <p className="rounded-[var(--radius-control)] bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{state.error}</p> : null}
        {state?.ok ? (
          <p className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] bg-success-50 px-4 py-2.5 text-sm text-success-700">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4" aria-hidden /> {state.message}
            </span>
            <Link href="/cart" className="font-semibold underline underline-offset-4">
              View cart
            </Link>
          </p>
        ) : null}
      </div>

      {/* Phone buy bar: docks above the tab bar once the main button has scrolled away. */}
      <div
        className={cn(
          "fixed inset-x-3 bottom-[calc(4.875rem+max(0.5rem,env(safe-area-inset-bottom)))] z-40 transition-[translate,opacity] duration-[var(--dur-base)] ease-[var(--ease-spring)] md:hidden",
          bar && !toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
        inert={!bar || toast}
      >
        <div className="glass-thick mx-auto flex max-w-md items-center gap-3 rounded-full p-1.5 pl-5 [--glass-shadow:var(--shadow-lift)]">
          <div className="min-w-0 flex-1 leading-tight">
            {title ? <p className="truncate text-xs text-umber-700">{title}</p> : null}
            <div className="text-base font-semibold text-umber-900">{priceSlot}</div>
          </div>
          <button
            type="submit"
            disabled={pending || !!disabledReason}
            className="pressable inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-terracotta-600 px-5 text-[0.95rem] font-medium text-white hover:bg-terracotta-700 disabled:opacity-50"
          >
            <ShoppingBag className="size-[18px]" aria-hidden />
            {disabledReason ? disabledReason : pending ? "Adding…" : "Add to cart"}
          </button>
        </div>
      </div>

      {toast ? (
        <Toast
          icon={<CheckCircle2 className="size-5 text-gold-300" aria-hidden />}
          onDismiss={() => setToast(false)}
          action={
            <Link href="/cart" className="pressable inline-flex h-9 shrink-0 items-center rounded-full bg-gold-300 px-4 text-sm font-semibold text-ink hover:bg-gold-200">
              View cart
            </Link>
          }
        >
          Added to your cart. Shipping and import costs are itemised there.
        </Toast>
      ) : null}
    </form>
  );
}
