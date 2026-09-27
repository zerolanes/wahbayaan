"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveListing } from "@/app/actions/seller";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card, CardHeader, Notice } from "@/components/ui/misc";
import type { CustomizationOption } from "@/lib/db/schema";

export type ListingDefaults = {
  id?: string;
  title?: string;
  categoryId?: string;
  summary?: string | null;
  description?: string | null;
  story?: string | null;
  pricePkr?: number | null;
  compareAtPricePkr?: number | null;
  availability?: "ready_to_ship" | "made_to_order";
  stockQty?: number;
  isOneOfAKind?: boolean;
  timeToMakeDays?: number | null;
  dispatchDays?: number | null;
  widthCm?: string | null;
  heightCm?: string | null;
  depthCm?: string | null;
  weightG?: number | null;
  materials?: string[];
  techniques?: string[];
  careInstructions?: string | null;
  videoUrl?: string | null;
  customizationOptions?: CustomizationOption[];
  wholesaleEnabled?: boolean;
  wholesaleMinQty?: number | null;
  wholesalePricePkr?: number | null;
  status?: string;
};

type Opt = { id: string; label: string; kind: "text" | "select"; choices: string; required: boolean; maxLength: string; extraPrice: string };

const rs = (minor?: number | null) => (minor ? String(minor / 100) : "");

/** Listing editor: every field a buyer (and the shipping quote) needs. */
export function ListingForm({ categories, defaults = {} }: { categories: { id: string; name: string }[]; defaults?: ListingDefaults }) {
  const [state, action, pending] = useActionState(saveListing, null);
  const [availability, setAvailability] = useState(defaults.availability ?? "ready_to_ship");
  const [opts, setOpts] = useState<Opt[]>(
    (defaults.customizationOptions ?? []).map((o) => ({
      id: o.id,
      label: o.label,
      kind: o.kind,
      choices: (o.choices ?? []).join(", "),
      required: !!o.required,
      maxLength: o.maxLength ? String(o.maxLength) : "",
      extraPrice: o.extraPricePkr ? String(o.extraPricePkr / 100) : "",
    })),
  );
  const customizationJson = JSON.stringify(
    opts.map((o) => ({
      id: o.id,
      label: o.label,
      kind: o.kind,
      choices: o.choices.split(","),
      required: o.required,
      maxLength: Number(o.maxLength) || undefined,
      extraPricePkr: Number(o.extraPrice) || undefined,
    })),
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="productId" value={defaults.id ?? ""} />
      <input type="hidden" name="customizationJson" value={customizationJson} />
      {state?.error ? <Notice tone="danger">{state.error}</Notice> : null}
      {state?.ok && state.message ? <Notice tone="success">{state.message}</Notice> : null}

      <Card>
        <CardHeader title="The piece" description="Write it the way you'd describe it to a visitor in your workshop." />
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <Field label="Title" htmlFor="title" required className="md:col-span-2">
            <Input id="title" name="title" defaultValue={defaults.title} required maxLength={140} placeholder="e.g. Madder-red Bukhara rug, 6×9 ft" />
          </Field>
          <Field label="Category" htmlFor="categoryId" required>
            <Select id="categoryId" name="categoryId" defaultValue={defaults.categoryId ?? ""} required>
              <option value="" disabled>
                Choose…
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="One-line summary" htmlFor="summary" hint="Shown under the title on product cards.">
            <Input id="summary" name="summary" defaultValue={defaults.summary ?? ""} maxLength={240} />
          </Field>
          <Field
            label="Description"
            htmlFor="description"
            className="md:col-span-2"
            hint="Materials, technique, what makes it special. At least 60 characters to submit."
          >
            <Textarea id="description" name="description" defaultValue={defaults.description ?? ""} rows={6} />
          </Field>
          <Field label="The story behind it (optional)" htmlFor="story" className="md:col-span-2">
            <Textarea id="story" name="story" defaultValue={defaults.story ?? ""} rows={3} placeholder="Who made it, how long it took, what inspired it." />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Price & availability" description="All prices are in Pakistani rupees. Buyers see them converted to their currency." />
        <div className="grid gap-5 p-5 md:grid-cols-3">
          <Field label="Your price (Rs)" htmlFor="pricePkr" required hint="What you want for the piece. Shipping and duty are added for the buyer.">
            <Input id="pricePkr" name="pricePkr" inputMode="numeric" defaultValue={rs(defaults.pricePkr)} required placeholder="45000" />
          </Field>
          <Field label="Was price (Rs, optional)" htmlFor="compareAtPricePkr">
            <Input id="compareAtPricePkr" name="compareAtPricePkr" inputMode="numeric" defaultValue={rs(defaults.compareAtPricePkr)} />
          </Field>
          <Field label="Availability" htmlFor="availability">
            <Select
              id="availability"
              name="availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value as "ready_to_ship" | "made_to_order")}
            >
              <option value="ready_to_ship">Ready to ship</option>
              <option value="made_to_order">Made to order</option>
            </Select>
          </Field>
          {availability === "ready_to_ship" ? (
            <>
              <Field label="In stock" htmlFor="stockQty">
                <Input id="stockQty" name="stockQty" type="number" min={0} defaultValue={defaults.stockQty ?? 1} />
              </Field>
              <Field label="Dispatch within (days)" htmlFor="dispatchDays" hint="Time to pack and hand to the courier.">
                <Input id="dispatchDays" name="dispatchDays" type="number" min={0} defaultValue={defaults.dispatchDays ?? ""} />
              </Field>
            </>
          ) : (
            <Field label="Time to make (days)" htmlFor="timeToMakeDays" hint="Shown to buyers on the listing.">
              <Input id="timeToMakeDays" name="timeToMakeDays" type="number" min={1} defaultValue={defaults.timeToMakeDays ?? ""} />
            </Field>
          )}
          <div className="flex items-end md:col-span-1">
            <Checkbox name="isOneOfAKind" defaultChecked={defaults.isOneOfAKind} label="One of a kind (issues a certificate of authenticity)" />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Size, weight & materials"
          description="Weight and size are needed for the courier quote — pieces without them can't be priced for shipping."
        />
        <div className="grid gap-5 p-5 md:grid-cols-4">
          <Field label="Width (cm)" htmlFor="widthCm">
            <Input id="widthCm" name="widthCm" inputMode="decimal" defaultValue={defaults.widthCm ?? ""} />
          </Field>
          <Field label="Height / length (cm)" htmlFor="heightCm">
            <Input id="heightCm" name="heightCm" inputMode="decimal" defaultValue={defaults.heightCm ?? ""} />
          </Field>
          <Field label="Depth (cm)" htmlFor="depthCm">
            <Input id="depthCm" name="depthCm" inputMode="decimal" defaultValue={defaults.depthCm ?? ""} />
          </Field>
          <Field label="Packed weight (kg)" htmlFor="weightKg" required>
            <Input id="weightKg" name="weightKg" inputMode="decimal" defaultValue={defaults.weightG ? String(defaults.weightG / 1000) : ""} />
          </Field>
          <Field label="Materials" htmlFor="materials" className="md:col-span-2" hint="Separate with commas: hand-spun wool, cotton foundation">
            <Input id="materials" name="materials" defaultValue={(defaults.materials ?? []).join(", ")} />
          </Field>
          <Field label="Techniques" htmlFor="techniques" className="md:col-span-2" hint="e.g. hand-knotted, Nastaliq, gilding">
            <Input id="techniques" name="techniques" defaultValue={(defaults.techniques ?? []).join(", ")} />
          </Field>
          <Field label="Care instructions" htmlFor="careInstructions" className="md:col-span-4">
            <Textarea id="careInstructions" name="careInstructions" defaultValue={defaults.careInstructions ?? ""} rows={2} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Photos, video & 3D"
          description="Real photos in daylight sell best: the whole piece, a close-up of the detail, and it in a room for scale."
        />
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <Field label="Add photos" htmlFor="images" hint="JPG, PNG or WebP up to 10 MB each. You can reorder them after saving.">
            <Input id="images" name="images" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="h-auto py-2" />
          </Field>
          <Field label="Process video link (optional)" htmlFor="videoUrl" hint="YouTube or Instagram link showing the piece being made.">
            <Input id="videoUrl" name="videoUrl" type="url" defaultValue={defaults.videoUrl ?? ""} placeholder="https://" />
          </Field>
          <Field
            label="3D scan (optional, .glb)"
            htmlFor="scan"
            hint="If you have a 3D scan of this exact piece, buyers can rotate it on the listing."
            className="md:col-span-2"
          >
            <Input id="scan" name="scan" type="file" accept=".glb,model/gltf-binary" className="h-auto py-2" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Customisation options"
          description="Let buyers personalise the piece — a name to write, a size or a colourway."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setOpts((o) => [...o, { id: `opt${o.length + 1}`, label: "", kind: "text", choices: "", required: false, maxLength: "", extraPrice: "" }])
              }
            >
              <Plus className="size-4" /> Add option
            </Button>
          }
        />
        <div className="space-y-4 p-5">
          {opts.length === 0 ? <p className="text-umber-500 text-sm">No options — the piece is sold as listed.</p> : null}
          {opts.map((o, i) => (
            <div key={i} className="bg-sand-100/70 grid gap-3 rounded-xl p-4 md:grid-cols-[2fr_1fr_2fr_1fr_auto]">
              <Input
                aria-label="Option label"
                placeholder="Label, e.g. Name to write"
                value={o.label}
                onChange={(e) => setOpts((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <Select
                aria-label="Option type"
                value={o.kind}
                onChange={(e) => setOpts((all) => all.map((x, j) => (j === i ? { ...x, kind: e.target.value as "text" | "select" } : x)))}
              >
                <option value="text">Free text</option>
                <option value="select">Choice list</option>
              </Select>
              {o.kind === "select" ? (
                <Input
                  aria-label="Choices"
                  placeholder="Choices, comma separated"
                  value={o.choices}
                  onChange={(e) => setOpts((all) => all.map((x, j) => (j === i ? { ...x, choices: e.target.value } : x)))}
                />
              ) : (
                <Input
                  aria-label="Maximum length"
                  placeholder="Max characters, e.g. 40"
                  inputMode="numeric"
                  value={o.maxLength}
                  onChange={(e) => setOpts((all) => all.map((x, j) => (j === i ? { ...x, maxLength: e.target.value } : x)))}
                />
              )}
              <Input
                aria-label="Extra price (Rs)"
                placeholder="+ Rs (optional)"
                inputMode="numeric"
                value={o.extraPrice}
                onChange={(e) => setOpts((all) => all.map((x, j) => (j === i ? { ...x, extraPrice: e.target.value } : x)))}
              />
              <div className="flex items-center gap-3">
                <label className="text-umber-700 flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={o.required}
                    onChange={(e) => setOpts((all) => all.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))}
                    className="accent-indigo-800"
                  />
                  Required
                </label>
                <button
                  type="button"
                  aria-label="Remove option"
                  className="text-umber-500 hover:text-danger-600"
                  onClick={() => setOpts((all) => all.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Trade pricing (optional)"
          description="Offer a lower per-piece price to approved interior designers and retailers ordering in quantity."
        />
        <div className="grid gap-5 p-5 md:grid-cols-3">
          <div className="flex items-end">
            <Checkbox name="wholesaleEnabled" defaultChecked={defaults.wholesaleEnabled} label="Available to trade buyers" />
          </div>
          <Field label="Minimum quantity" htmlFor="wholesaleMinQty">
            <Input id="wholesaleMinQty" name="wholesaleMinQty" type="number" min={2} defaultValue={defaults.wholesaleMinQty ?? ""} />
          </Field>
          <Field label="Trade price per piece (Rs)" htmlFor="wholesalePricePkr">
            <Input id="wholesalePricePkr" name="wholesalePricePkr" inputMode="numeric" defaultValue={rs(defaults.wholesalePricePkr)} />
          </Field>
        </div>
      </Card>

      <div className="border-umber-200/60 bg-sand-100/90 sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <p className="text-umber-500 mr-auto text-xs">
          {defaults.status === "active"
            ? "Editing a live listing sends it back for a quick review."
            : "Submitted listings are reviewed by our team before they go live."}
        </p>
        <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending}>
          Save draft
        </Button>
        <Button type="submit" name="intent" value="submit" disabled={pending}>
          {pending ? "Saving…" : "Submit for review"}
        </Button>
      </div>
    </form>
  );
}
