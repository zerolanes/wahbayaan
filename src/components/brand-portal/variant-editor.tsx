"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TextInput } from "@/components/admin/controls";

export type EditorVariant = { id: string | null; size: string; colour: string; sku: string; price: string; compareAt: string; stock: string; available: boolean };

/**
 * Variant grid for the product editor: size, colour, SKU, price and original
 * price in rupees, stock and availability per variant. Field names are
 * `v.<n>.<field>`; blank new rows are ignored by the server.
 */
export function VariantEditor({ initial }: { initial: EditorVariant[] }) {
  const blank = (): EditorVariant => ({ id: null, size: "", colour: "", sku: "", price: initial[0]?.price ?? "", compareAt: "", stock: "", available: true });
  const [rows, setRows] = useState<EditorVariant[]>(initial.length ? initial : [blank()]);
  const cell = "px-1.5 py-1.5 align-middle";
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-umber-500">
              <th className={cell}>Size</th>
              <th className={cell}>Colour</th>
              <th className={cell}>SKU</th>
              <th className={cell}>Price (Rs)</th>
              <th className={cell}>Original (Rs)</th>
              <th className={cell}>Stock</th>
              <th className={cell}>Available</th>
              <th className={cell}>Remove</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-umber-100" data-variant-row={i}>
                <td className={cell}>
                  {r.id ? <input type="hidden" name={`v.${i}.id`} value={r.id} /> : null}
                  <TextInput name={`v.${i}.size`} defaultValue={r.size} aria-label={`Variant ${i + 1} size`} className="w-16" />
                </td>
                <td className={cell}>
                  <TextInput name={`v.${i}.colour`} defaultValue={r.colour} aria-label={`Variant ${i + 1} colour`} className="w-24" />
                </td>
                <td className={cell}>
                  <TextInput name={`v.${i}.sku`} defaultValue={r.sku} aria-label={`Variant ${i + 1} SKU`} className="w-32 font-mono text-xs" />
                </td>
                <td className={cell}>
                  <TextInput name={`v.${i}.price`} defaultValue={r.price} inputMode="decimal" aria-label={`Variant ${i + 1} price in rupees`} className="w-20" />
                </td>
                <td className={cell}>
                  <TextInput name={`v.${i}.compareAt`} defaultValue={r.compareAt} inputMode="decimal" aria-label={`Variant ${i + 1} original price in rupees`} className="w-20" placeholder="—" />
                </td>
                <td className={cell}>
                  <TextInput name={`v.${i}.stock`} defaultValue={r.stock} type="number" min={0} aria-label={`Variant ${i + 1} stock`} className="w-16" placeholder="—" />
                </td>
                <td className={`${cell} text-center`}>
                  <input type="checkbox" name={`v.${i}.available`} defaultChecked={r.available} aria-label={`Variant ${i + 1} available`} className="size-4" />
                </td>
                <td className={`${cell} text-center`}>
                  <input type="checkbox" name={`v.${i}.remove`} aria-label={`Remove variant ${i + 1}`} className="size-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => setRows((r) => [...r, blank()])} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-umber-200 bg-white px-3 text-xs font-medium text-umber-800 hover:border-umber-300">
        <Plus className="size-3.5" aria-hidden /> Add a variant
      </button>
      <p className="text-xs text-umber-500">Stock blank = not tracked. Stock 0 shows the size as sold out. The original price shows as a sale when it&apos;s higher than the price.</p>
    </div>
  );
}
