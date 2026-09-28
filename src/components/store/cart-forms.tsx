"use client";

import { useActionState, useState } from "react";
import { Gift, Tag, X } from "lucide-react";
import { applyCoupon, removeCoupon, saveGiftOptions } from "@/app/actions/cart";
import { cn } from "@/lib/utils/cn";

const input =
  "w-full rounded-xl border border-umber-200 bg-white/90 px-3.5 text-[0.95rem] text-umber-900 placeholder:text-umber-400 transition focus:border-gold-500 focus:ring-4 focus:ring-gold-200/50 focus:outline-none";

export function CouponForm({ code, error }: { code: string | null; error: string | null }) {
  const [state, action, pending] = useActionState(applyCoupon, null);
  if (code)
    return (
      <div className="space-y-1.5">
        <div className={cn("flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm", error ? "bg-danger-50 text-danger-700" : "bg-success-50 text-success-700")}>
          <span className="flex items-center gap-2">
            <Tag className="size-4" aria-hidden />
            <span className="font-semibold tracking-wide">{code}</span>
            {error ? null : <span>applied</span>}
          </span>
          <form action={removeCoupon}>
            <button type="submit" className="inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline">
              <X className="size-3.5" aria-hidden /> Remove
            </button>
          </form>
        </div>
        {error ? <p className="text-sm text-danger-600">{error}</p> : null}
      </div>
    );
  return (
    <form action={action} className="space-y-1.5">
      <label htmlFor="coupon" className="text-sm font-medium text-umber-800">
        Promo code
      </label>
      <div className="flex gap-2">
        <input id="coupon" name="code" className={cn(input, "h-11 uppercase placeholder:normal-case")} placeholder="Enter a code" autoComplete="off" />
        <button disabled={pending} className="h-11 shrink-0 rounded-full border border-umber-300/70 px-5 text-sm font-medium text-umber-900 transition hover:border-umber-900 disabled:opacity-50">
          {pending ? "…" : "Apply"}
        </button>
      </div>
      {state?.error ? <p className="text-sm text-danger-600">{state.error}</p> : null}
    </form>
  );
}

export function GiftForm({ isGift, giftWrap, message, wrapNote }: { isGift: boolean; giftWrap: boolean; message: string | null; wrapNote: string }) {
  const [state, action, pending] = useActionState(saveGiftOptions, null);
  const [open, setOpen] = useState(isGift);
  return (
    <form action={action} className="rounded-2xl bg-sand-100/70 p-4 ring-1 ring-umber-200/50">
      <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-umber-900">
        <input type="checkbox" name="isGift" defaultChecked={isGift} onChange={(e) => setOpen(e.target.checked)} className="size-4 accent-indigo-800" />
        <Gift className="size-4 text-terracotta-600" aria-hidden /> This is a gift
      </label>
      <div className={cn("mt-3 space-y-3", !open && "hidden")}>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-umber-800">
          <input type="checkbox" name="giftWrap" defaultChecked={giftWrap} className="mt-0.5 size-4 accent-indigo-800" />
          <span>
            Gift wrap each piece
            <span className="block text-xs text-umber-500">{wrapNote}</span>
          </span>
        </label>
        <div className="space-y-1">
          <label htmlFor="giftMessage" className="text-sm font-medium text-umber-800">
            Gift message <span className="font-normal text-umber-400">(printed on a card, no prices included)</span>
          </label>
          <textarea id="giftMessage" name="giftMessage" defaultValue={message ?? ""} maxLength={500} rows={3} className={cn(input, "py-2.5")} placeholder="Happy anniversary — from Lahore, with love." />
        </div>
        <p className="text-xs text-umber-500">Ship straight to the recipient — enter their address at checkout.</p>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button disabled={pending} className="h-9 rounded-full bg-indigo-900 px-4 text-sm font-medium text-sand-50 transition hover:bg-indigo-800 disabled:opacity-50">
          {pending ? "Saving…" : "Save gift options"}
        </button>
        {state?.message ? <p className="text-xs text-success-700">{state.message}</p> : null}
        {state?.error ? <p className="text-xs text-danger-600">{state.error}</p> : null}
      </div>
    </form>
  );
}
