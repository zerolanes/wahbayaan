"use client";

import { useActionState } from "react";
import { subscribeNewsletter } from "@/app/actions/newsletter";

export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const [state, action, pending] = useActionState(subscribeNewsletter, null);
  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="source" value={source} />
      <label htmlFor={`nl-${source}`} className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">
        Stories from the workshops
      </label>
      <div className="mt-3 flex overflow-hidden rounded-full border border-white/15 bg-white/5 focus-within:border-gold-400">
        <input
          id={`nl-${source}`}
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-sand-50 placeholder:text-sand-200/40 focus:outline-none"
        />
        <button disabled={pending} className="bg-gold-400 px-4 text-sm font-medium text-ink transition hover:bg-gold-300 disabled:opacity-60">
          {pending ? "…" : "Join"}
        </button>
      </div>
      {state ? <p className={`mt-2 text-xs ${state.ok ? "text-gold-200" : "text-terracotta-300"}`}>{state.message}</p> : null}
    </form>
  );
}
