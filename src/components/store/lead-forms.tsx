"use client";

import { useActionState, useState } from "react";
import { ImagePlus } from "lucide-react";
import { submitContact, submitVendorApplication, submitWholesale } from "@/app/actions/forms";
import { BUSINESS_TYPES, CONTACT_TOPICS } from "@/lib/forms-data";
import { fieldClass, FormError, FormRow, SubmitButton, SuccessPanel } from "./form-bits";

type Option = { id: string; label: string };

export function ContactForm({ defaults }: { defaults: { name: string; email: string; topic?: string; orderNumber?: string } }) {
  const [state, action, pending] = useActionState(submitContact, null);
  const fe = state?.fieldErrors ?? {};
  if (state?.ok) return <SuccessPanel title="Message sent">{state.message}</SuccessPanel>;
  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow id="name" label="Your name" error={fe.name}>
          <input id="name" name="name" defaultValue={defaults.name} autoComplete="name" className={fieldClass(fe.name)} />
        </FormRow>
        <FormRow id="email" label="Email" error={fe.email}>
          <input id="email" name="email" type="email" defaultValue={defaults.email} autoComplete="email" className={fieldClass(fe.email)} />
        </FormRow>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow id="topic" label="What's it about?" error={fe.topic}>
          <select id="topic" name="topic" defaultValue={defaults.topic ?? ""} className={fieldClass(fe.topic, "h-11")}>
            <option value="">Choose a topic…</option>
            {CONTACT_TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow id="orderNumber" label="Order number" optional error={fe.orderNumber} hint="Starts with WB- — it's in your confirmation email.">
          <input id="orderNumber" name="orderNumber" defaultValue={defaults.orderNumber} className={fieldClass(fe.orderNumber)} placeholder="WB-…" />
        </FormRow>
      </div>
      <FormRow id="message" label="Message" error={fe.message}>
        <textarea id="message" name="message" rows={6} className={fieldClass(fe.message)} />
      </FormRow>
      <FormError message={state?.error} />
      <SubmitButton pending={pending}>Send message</SubmitButton>
    </form>
  );
}

export function WholesaleForm({ defaults, destinations }: { defaults: { name: string; email: string; country: string }; destinations: { code: string; name: string }[] }) {
  const [state, action, pending] = useActionState(submitWholesale, null);
  const fe = state?.fieldErrors ?? {};
  if (state?.ok) return <SuccessPanel title="Application received">{state.message}</SuccessPanel>;
  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow id="businessName" label="Business name" error={fe.businessName}>
          <input id="businessName" name="businessName" autoComplete="organization" className={fieldClass(fe.businessName)} />
        </FormRow>
        <FormRow id="businessType" label="Type of business" error={fe.businessType}>
          <select id="businessType" name="businessType" defaultValue="" className={fieldClass(fe.businessType, "h-11")}>
            <option value="">Choose…</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </FormRow>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow id="contactName" label="Your name" error={fe.contactName}>
          <input id="contactName" name="contactName" defaultValue={defaults.name} autoComplete="name" className={fieldClass(fe.contactName)} />
        </FormRow>
        <FormRow id="email" label="Work email" error={fe.email}>
          <input id="email" name="email" type="email" defaultValue={defaults.email} autoComplete="email" className={fieldClass(fe.email)} />
        </FormRow>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow id="country" label="Country" error={fe.country}>
          <select id="country" name="country" defaultValue={defaults.country} className={fieldClass(fe.country, "h-11")}>
            {destinations.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow id="website" label="Website" optional error={fe.website}>
          <input id="website" name="website" type="url" placeholder="https://" className={fieldClass(fe.website)} />
        </FormRow>
      </div>
      <FormRow id="expectedVolume" label="Expected volume" optional hint="e.g. 20 rugs a year, or one hotel fit-out">
        <input id="expectedVolume" name="expectedVolume" className={fieldClass()} />
      </FormRow>
      <FormRow id="message" label="Tell us about the project" optional>
        <textarea id="message" name="message" rows={4} className={fieldClass()} />
      </FormRow>
      <FormError message={state?.error} />
      <SubmitButton pending={pending}>Apply for a trade account</SubmitButton>
    </form>
  );
}

export function ArtisanApplicationForm({ categories, regions, defaults }: { categories: Option[]; regions: Option[]; defaults: { name: string; email: string } }) {
  const [state, action, pending] = useActionState(submitVendorApplication, null);
  const [files, setFiles] = useState<string[]>([]);
  const fe = state?.fieldErrors ?? {};
  if (state?.ok)
    return (
      <SuccessPanel title="Application received">
        Thank you, {state.message}. Our artisan team reviews every application by hand. We&apos;ll contact you by phone or email about the next step — a short video call and a workshop check.
      </SuccessPanel>
    );
  return (
    <form action={action} className="space-y-10" noValidate>
      <fieldset className="space-y-5">
        <legend className="font-display text-2xl text-umber-900">About you</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormRow id="fullName" label="Full name" error={fe.fullName}>
            <input id="fullName" name="fullName" defaultValue={defaults.name} autoComplete="name" className={fieldClass(fe.fullName)} />
          </FormRow>
          <FormRow id="phone" label="Phone or WhatsApp" error={fe.phone}>
            <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+92 3…" className={fieldClass(fe.phone)} />
          </FormRow>
        </div>
        <FormRow id="email" label="Email" error={fe.email}>
          <input id="email" name="email" type="email" defaultValue={defaults.email} autoComplete="email" className={fieldClass(fe.email)} />
        </FormRow>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-display text-2xl text-umber-900">Your craft and workshop</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormRow id="craft" label="What do you make?" error={fe.craft}>
            <input id="craft" name="craft" placeholder="e.g. Hand-knotted wool rugs" className={fieldClass(fe.craft)} />
          </FormRow>
          <FormRow id="categoryId" label="Closest category" optional>
            <select id="categoryId" name="categoryId" defaultValue="" className={fieldClass(undefined, "h-11")}>
              <option value="">Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </FormRow>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <FormRow id="workshopCity" label="Workshop city" error={fe.workshopCity}>
            <input id="workshopCity" name="workshopCity" placeholder="e.g. Multan" className={fieldClass(fe.workshopCity)} />
          </FormRow>
          <FormRow id="workshopRegion" label="Province / region" error={fe.workshopRegion}>
            <select id="workshopRegion" name="workshopRegion" defaultValue="" className={fieldClass(fe.workshopRegion, "h-11")}>
              <option value="">Choose…</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow id="yearsPracticing" label="Years practising" optional error={fe.yearsPracticing}>
            <input id="yearsPracticing" name="yearsPracticing" type="number" min={0} max={90} className={fieldClass(fe.yearsPracticing)} />
          </FormRow>
        </div>
        <FormRow id="story" label="Tell us about your work" error={fe.story} hint="Who taught you, what materials you use, how long a typical piece takes.">
          <textarea id="story" name="story" rows={5} className={fieldClass(fe.story)} />
        </FormRow>
        <label className="flex items-center gap-2.5 text-sm text-umber-800">
          <input type="checkbox" name="exportedBefore" className="size-4 accent-indigo-900" /> I have sold or shipped work abroad before
        </label>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-display text-2xl text-umber-900">Your work</legend>
        <FormRow id="samples" label="Photos of finished pieces" error={fe.samples} hint="1–8 photos, JPG/PNG/WebP under 10 MB each. Daylight photos on a plain background work best.">
          <label className={fieldClass(fe.samples, "flex cursor-pointer items-center gap-3 border-dashed py-6")}>
            <ImagePlus className="size-6 text-umber-500" aria-hidden />
            <span className="text-sm text-umber-600">{files.length ? files.join(", ") : "Choose photos"}</span>
            <input
              id="samples"
              name="samples"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => setFiles([...(e.target.files ?? [])].map((f) => f.name))}
            />
          </label>
        </FormRow>
        <div className="grid gap-5 sm:grid-cols-3">
          <FormRow id="portfolioUrl" label="Website or portfolio" optional error={fe.portfolioUrl}>
            <input id="portfolioUrl" name="portfolioUrl" type="url" placeholder="https://" className={fieldClass(fe.portfolioUrl)} />
          </FormRow>
          <FormRow id="instagram" label="Instagram" optional>
            <input id="instagram" name="instagram" placeholder="@yourworkshop" className={fieldClass()} />
          </FormRow>
          <FormRow id="videoUrl" label="Video of your process" optional error={fe.videoUrl}>
            <input id="videoUrl" name="videoUrl" type="url" placeholder="https://" className={fieldClass(fe.videoUrl)} />
          </FormRow>
        </div>
      </fieldset>

      <FormError message={state?.error} />
      <SubmitButton pending={pending} pendingLabel="Uploading…">
        Submit application
      </SubmitButton>
    </form>
  );
}
