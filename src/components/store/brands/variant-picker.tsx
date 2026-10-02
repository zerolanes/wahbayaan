"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { CheckCircle2, ShoppingBag } from "lucide-react";
import { addToBrandBagForm } from "@/app/actions/brands";
import { cn } from "@/lib/utils/cn";

export type PickerVariant = {
  id: string;
  size: string | null;
  colour: string | null;
  available: boolean;
  stockQty: number | null;
  /** Already formatted in the buyer's currency. */
  priceLabel: string;
  wasLabel: string | null;
};

/** Size and colour pickers with Add to bag. Sold-out combinations are disabled, not hidden. */
export function VariantPicker({ variants, sizes, colours }: { variants: PickerVariant[]; sizes: string[]; colours: string[] }) {
  const [state, action, pending] = useActionState(addToBrandBagForm, null);
  const firstOk = variants.find((v) => v.available && v.stockQty !== 0) ?? variants[0];
  const [size, setSize] = useState<string | null>(sizes.length ? (firstOk?.size ?? null) : null);
  const [colour, setColour] = useState<string | null>(colours.length ? (firstOk?.colour ?? null) : null);
  const [qty, setQty] = useState(1);

  const match = useMemo(() => variants.find((v) => (sizes.length ? v.size === size : true) && (colours.length ? v.colour === colour : true)) ?? null, [variants, sizes, colours, size, colour]);
  const buyable = !!match && match.available && match.stockQty !== 0;
  const sizeOk = (s: string) => variants.some((v) => v.size === s && (!colours.length || v.colour === colour) && v.available && v.stockQty !== 0);
  const colourOk = (c: string) => variants.some((v) => v.colour === c && (!sizes.length || v.size === size) && v.available && v.stockQty !== 0);

  const chip = (active: boolean, ok: boolean) =>
    cn(
      "min-w-11 rounded-full border px-3.5 py-2 text-sm font-medium transition",
      active ? "border-indigo-900 bg-indigo-900 text-sand-50" : "border-umber-300/70 text-umber-800 hover:border-umber-900",
      !ok && !active && "text-umber-400 line-through decoration-umber-400",
    );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="variantId" value={match?.id ?? ""} />
      {colours.length ? (
        <fieldset>
          <legend className="text-sm font-medium text-umber-800">
            Colour <span className="font-normal text-umber-500">· {colour ?? "choose"}</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {colours.map((c) => (
              <button key={c} type="button" aria-pressed={colour === c} onClick={() => setColour(c)} className={chip(colour === c, colourOk(c))}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      {sizes.length ? (
        <fieldset>
          <legend className="flex w-full items-baseline justify-between text-sm font-medium text-umber-800">
            <span>
              Size <span className="font-normal text-umber-500">· {size ?? "choose"}</span>
            </span>
            <a href="#size-guide" className="text-xs font-normal text-terracotta-600 hover:underline">
              Size guide
            </a>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)} className={chip(size === s, sizeOk(s))}>
                {s}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex items-baseline gap-3 text-sm">
        {match ? (
          <>
            <span className="text-lg font-semibold text-umber-900 tabular-nums">{match.priceLabel}</span>
            {match.wasLabel ? <span className="text-umber-400 line-through tabular-nums">{match.wasLabel}</span> : null}
            <span className={buyable ? "text-success-700" : "text-danger-700"}>
              {!buyable ? "Sold out" : match.stockQty != null && match.stockQty <= 3 ? `Only ${match.stockQty} left` : match.stockQty == null ? "Availability confirmed when we order" : "In stock"}
            </span>
          </>
        ) : (
          <span className="text-umber-500">This combination isn&apos;t made — pick another.</span>
        )}
      </div>

      <div className="flex gap-3">
        <label className="sr-only" htmlFor="qty">
          Quantity
        </label>
        <input id="qty" name="qty" type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className="h-13 w-20 rounded-full border border-umber-300/70 bg-sand-50/70 text-center text-sm font-semibold" />
        <button
          type="submit"
          disabled={pending || !buyable}
          className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-full bg-terracotta-600 px-6 text-base font-medium text-white shadow-soft transition hover:bg-terracotta-700 disabled:pointer-events-none disabled:opacity-50"
        >
          <ShoppingBag className="size-5" aria-hidden />
          {pending ? "Adding…" : buyable ? "Add to bag" : "Sold out"}
        </button>
      </div>
      <div aria-live="polite">
        {state?.error ? <p className="rounded-xl bg-danger-50 px-4 py-2.5 text-sm text-danger-700">{state.error}</p> : null}
        {state?.ok ? (
          <p className="flex items-center justify-between gap-3 rounded-xl bg-success-50 px-4 py-2.5 text-sm text-success-700">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4" aria-hidden /> {state.message}
            </span>
            <Link href="/brands/bag" className="font-semibold underline underline-offset-4">
              View bag
            </Link>
          </p>
        ) : null}
      </div>
    </form>
  );
}
