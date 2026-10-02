"use client";

import { useActionState } from "react";
import { Bell } from "lucide-react";
import { subscribeBrandAlert } from "@/app/actions/brands";

/** "Notify me" for a sale or a restock. Stored; emails are queued when it happens. */
export function NotifyForm({ brandId, productId, kind, email }: { brandId: string; productId?: string; kind: "sale" | "restock"; email?: string }) {
  const [state, action, pending] = useActionState(subscribeBrandAlert, null);
  if (state?.ok) return <p className="rounded-xl bg-success-50 px-4 py-2.5 text-sm text-success-700">{state.message}</p>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="brandId" value={brandId} />
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}
      <input type="hidden" name="kind" value={kind} />
      <label htmlFor={`notify-${kind}`} className="sr-only">
        Email
      </label>
      <input
        id={`notify-${kind}`}
        name="email"
        type="email"
        required
        defaultValue={email}
        placeholder="Your email"
        className="h-10 min-w-0 flex-1 rounded-full border border-umber-200 bg-white/90 px-4 text-sm focus:border-gold-500 focus:outline-none"
      />
      <button disabled={pending} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-umber-300/70 px-4 text-sm font-medium text-umber-900 hover:border-umber-900">
        <Bell className="size-4" aria-hidden /> {kind === "sale" ? "Tell me about sales" : "Notify me when back"}
      </button>
      {state?.error ? <p className="w-full text-sm text-danger-600">{state.error}</p> : null}
    </form>
  );
}
