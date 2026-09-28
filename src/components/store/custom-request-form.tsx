"use client";

import { useActionState, useState } from "react";
import { ImagePlus } from "lucide-react";
import { submitCustomRequest } from "@/app/actions/forms";
import { fieldClass, FormError, FormRow, SubmitButton } from "./form-bits";

type Option = { id: string; label: string };

export function CustomRequestForm({
  categories,
  artisans,
  defaults,
  currency,
  destinations,
}: {
  categories: Option[];
  artisans: (Option & { categoryId: string | null })[];
  defaults: { categoryId?: string; vendorSlug?: string; productSlug?: string; name: string; email: string; destination: string; details?: string };
  currency: string;
  destinations: { code: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(submitCustomRequest, null);
  const [category, setCategory] = useState(defaults.categoryId ?? "");
  const [files, setFiles] = useState<string[]>([]);
  const fe = state?.fieldErrors ?? {};
  const shown = category ? artisans.filter((a) => a.categoryId === category || a.id === defaults.vendorSlug) : artisans;

  return (
    <form action={action} className="space-y-10" noValidate>
      {defaults.productSlug ? <input type="hidden" name="productSlug" value={defaults.productSlug} /> : null}

      <fieldset className="space-y-5">
        <legend className="font-display text-2xl text-umber-900">What would you like made?</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormRow id="categoryId" label="Craft" error={fe.categoryId}>
            <select id="categoryId" name="categoryId" value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass(fe.categoryId, "h-11")}>
              <option value="">Choose a craft…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow id="vendorSlug" label="Artisan" hint="Leave it to us and we'll match you with a verified artisan.">
            <select id="vendorSlug" name="vendorSlug" defaultValue={defaults.vendorSlug ?? ""} className={fieldClass(undefined, "h-11")}>
              <option value="">Match me with an artisan</option>
              {shown.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </FormRow>
        </div>
        <FormRow id="details" label="Describe the piece" error={fe.details} hint="What is it for, where will it live, what should it feel like? Mention anything you love from existing listings.">
          <textarea id="details" name="details" rows={6} defaultValue={defaults.details} className={fieldClass(fe.details)} placeholder="A wedding gift: our names in Nastaliq, gold on deep indigo, for above the fireplace…" />
        </FormRow>
        <div className="grid gap-5 sm:grid-cols-3">
          <FormRow id="customText" label="Words or names to include" optional error={fe.customText}>
            <input id="customText" name="customText" maxLength={300} className={fieldClass(fe.customText, "h-11")} placeholder="Ayesha & Omar" />
          </FormRow>
          <FormRow id="sizeNotes" label="Size" optional error={fe.sizeNotes}>
            <input id="sizeNotes" name="sizeNotes" maxLength={200} className={fieldClass(fe.sizeNotes, "h-11")} placeholder="About 60 × 40 cm" />
          </FormRow>
          <FormRow id="colorNotes" label="Colours" optional error={fe.colorNotes}>
            <input id="colorNotes" name="colorNotes" maxLength={200} className={fieldClass(fe.colorNotes, "h-11")} placeholder="Indigo, ivory, gold leaf" />
          </FormRow>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormRow id="budget" label={`Budget (${currency})`} optional error={fe.budget} hint="Helps the artisan suggest materials and size. It isn't a commitment.">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-umber-500">{currency}</span>
              <input id="budget" name="budget" type="number" min={1} step={1} inputMode="numeric" className={fieldClass(fe.budget, "h-11 pl-14")} placeholder="600" />
            </div>
          </FormRow>
          <FormRow id="destination" label="Deliver to" error={fe.destination} hint="Shipping and import costs are quoted for this country.">
            <select id="destination" name="destination" defaultValue={defaults.destination} className={fieldClass(fe.destination, "h-11")}>
              {destinations.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </select>
          </FormRow>
        </div>
        <div>
          <label htmlFor="references" className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-umber-300 bg-sand-50/70 px-5 py-4 text-sm text-umber-700 transition hover:border-umber-500">
            <ImagePlus className="size-6 shrink-0 text-gold-600" aria-hidden />
            <span>
              <span className="block font-medium text-umber-900">Reference images (optional)</span>
              {files.length ? files.join(", ") : "Photos of your room, a sketch, colours you like — up to 6 images, 10 MB each."}
            </span>
          </label>
          <input id="references" name="references" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => setFiles([...(e.target.files ?? [])].map((f) => f.name))} />
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-display text-2xl text-umber-900">Where should we send the quote?</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormRow id="name" label="Your name" error={fe.name}>
            <input id="name" name="name" autoComplete="name" defaultValue={defaults.name} className={fieldClass(fe.name, "h-11")} />
          </FormRow>
          <FormRow id="email" label="Email" error={fe.email}>
            <input id="email" name="email" type="email" autoComplete="email" defaultValue={defaults.email} className={fieldClass(fe.email, "h-11")} />
          </FormRow>
        </div>
      </fieldset>

      <div className="space-y-4 border-t border-umber-200/70 pt-8">
        <FormError message={state?.error} />
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton pending={pending} pendingLabel="Sending your request…">
            Request a quote
          </SubmitButton>
          <p className="text-sm text-umber-500">Free, and nothing is charged until you accept a quote.</p>
        </div>
      </div>
    </form>
  );
}
