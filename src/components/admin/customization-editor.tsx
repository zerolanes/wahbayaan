"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { CustomizationOption } from "@/lib/db/schema";
import { SelectInput, TextInput, Toggle } from "./controls";

/** Edits a listing's buyer customization options; submitted as JSON. */
export function CustomizationEditor({ name, initial }: { name: string; initial: CustomizationOption[] }) {
  const [opts, setOpts] = useState<(CustomizationOption & { choicesText?: string })[]>(initial.map((o) => ({ ...o, choicesText: (o.choices ?? []).join(", ") })));
  const update = (i: number, patch: Partial<CustomizationOption & { choicesText?: string }>) => setOpts((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const serial = opts.map(({ choicesText, ...o }) => ({
    ...o,
    choices: o.kind === "select" ? (choicesText ?? "").split(",").map((c) => c.trim()).filter(Boolean) : undefined,
  }));
  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(serial)} />
      {opts.map((o, i) => (
        <div key={o.id} className="grid gap-2 rounded-xl border border-umber-200 bg-white/60 p-3 sm:grid-cols-[1.4fr_0.8fr_1.6fr_auto]">
          <TextInput value={o.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Label, e.g. Name to write" aria-label="Option label" />
          <SelectInput value={o.kind} onChange={(e) => update(i, { kind: e.target.value as "text" | "select" })} aria-label="Option type">
            <option value="text">Free text</option>
            <option value="select">Choice list</option>
          </SelectInput>
          {o.kind === "select" ? (
            <TextInput value={o.choicesText ?? ""} onChange={(e) => update(i, { choicesText: e.target.value })} placeholder="Choices, comma separated" aria-label="Choices" />
          ) : (
            <TextInput value={o.maxLength ?? ""} onChange={(e) => update(i, { maxLength: e.target.value ? Number(e.target.value) : undefined })} placeholder="Max characters" inputMode="numeric" aria-label="Max length" />
          )}
          <button type="button" onClick={() => setOpts((xs) => xs.filter((_, j) => j !== i))} className="grid size-9 place-items-center rounded-full text-umber-500 hover:bg-danger-50 hover:text-danger-700" aria-label="Remove option">
            <Trash2 className="size-4" />
          </button>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-4">
            <Toggle label="Required" checked={!!o.required} onChange={(e) => update(i, { required: e.target.checked })} />
            <label className="flex items-center gap-2 text-sm text-umber-700">
              Extra price (Rs)
              <TextInput
                value={o.extraPricePkr != null ? String(o.extraPricePkr / 100) : ""}
                onChange={(e) => update(i, { extraPricePkr: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined })}
                inputMode="decimal"
                className="w-28"
                aria-label="Extra price in PKR"
              />
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setOpts((xs) => [...xs, { id: `opt_${Date.now().toString(36)}`, label: "", kind: "text", required: false, choicesText: "" }])}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-umber-300 px-3 py-1.5 text-sm text-umber-700 hover:border-gold-500"
      >
        <Plus className="size-4" /> Add option
      </button>
    </div>
  );
}
