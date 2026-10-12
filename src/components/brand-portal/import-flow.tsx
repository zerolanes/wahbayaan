"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { portalImportAction, type ImportState } from "@/app/actions/brand-portal";
import { buttonClass } from "@/components/ui/button";
import { Badge, Notice } from "@/components/ui/misc";
import { formatMoney } from "@/lib/money/currency";

function Submit({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "outline" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, "sm")}>
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

const ACTION_TONE = { create: "success", update: "indigo", unchanged: "neutral" } as const;
const ACTION_LABEL = { create: "New", update: "Update", unchanged: "No change" } as const;

/** Upload → preview (row errors + what will change) → import. Nothing is written until "Import". */
export function ImportFlow() {
  const [state, action] = useActionState<ImportState, FormData>(portalImportAction, null);
  const preview = state?.preview;
  const plan = preview?.plan;
  const v = preview?.validated;
  const importable = plan ? plan.products.filter((p) => p.action !== "unchanged").length : 0;

  return (
    <div className="space-y-6">
      {state?.error ? <Notice tone="danger">{state.error}</Notice> : null}
      {state?.ok && state.message ? (
        <Notice tone="success" title="Import finished">
          {state.message}{" "}
          <Link href="/brand-portal/products?status=draft" className="font-medium underline">
            Review drafts
          </Link>
        </Notice>
      ) : null}

      <form action={action} className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-umber-300 bg-white p-4">
        <input type="hidden" name="step" value="preview" />
        <label className="block min-w-64 flex-1 text-sm">
          <span className="mb-1 block font-medium text-umber-800">CSV file</span>
          <input type="file" name="file" accept=".csv,text/csv" required className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-umber-200 file:bg-white file:px-3 file:py-1.5 file:text-sm" />
        </label>
        <Submit variant="outline">Check file</Submit>
      </form>

      {v && plan ? (
        <section aria-labelledby="preview-h" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="preview-h" className="text-base font-semibold">
              Preview: {state?.fileName} · {v.rowCount} rows
            </h2>
            <p className="text-sm text-umber-600">
              Products: <strong>{plan.counts.productsCreate}</strong> new, <strong>{plan.counts.productsUpdate}</strong> updated, {plan.counts.productsUnchanged} unchanged
              {plan.counts.skipped ? (
                <>
                  , <strong className="text-danger-700">{plan.counts.skipped} skipped</strong>
                </>
              ) : null}{" "}
              · Variants: {plan.counts.variantsCreate} new, {plan.counts.variantsUpdate} updated
            </p>
          </div>

          {v.errors.length ? (
            <div className="rounded-xl border border-danger-200 bg-danger-50/60 p-4">
              <p className="text-sm font-semibold text-danger-800">
                {v.errors.length} problem{v.errors.length === 1 ? "" : "s"} — these products will be skipped until fixed:
              </p>
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-sm text-danger-800" data-testid="row-errors">
                {v.errors.map((e, i) => (
                  <li key={i}>
                    <strong>Row {e.line}</strong>
                    {e.column ? <> · {e.column}</> : null}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {v.warnings.length ? (
            <ul className="space-y-1 text-xs text-umber-600">
              {v.warnings.map((w, i) => (
                <li key={i}>
                  Row {w.line}
                  {w.column ? ` · ${w.column}` : ""}: {w.message}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-umber-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-umber-50 text-left text-xs text-umber-600">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Change</th>
                  <th className="px-3 py-2">Variants</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Status after import</th>
                </tr>
              </thead>
              <tbody>
                {plan.products.map((p) => {
                  const prices = p.csv.variants.map((x) => x.pricePkr);
                  return (
                    <tr key={p.csv.handle} className="border-t border-umber-100">
                      <td className="px-3 py-2">
                        <span className="font-medium">{p.csv.title}</span>
                        <span className="block text-xs text-umber-500">
                          {p.csv.handle} · rows {p.csv.lines.join(", ")}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={ACTION_TONE[p.action]}>{ACTION_LABEL[p.action]}</Badge>
                        {p.changes.length ? <span className="block text-xs text-umber-500">{p.changes.join(", ")}</span> : null}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {p.variants.map((x) => (
                          <span key={x.csv.sku} className="mr-2 inline-block">
                            {[x.csv.size, x.csv.colour].filter(Boolean).join("/") || x.csv.sku}
                            {x.action !== "unchanged" ? <span className="text-umber-500"> ({x.action === "create" ? "new" : "upd"})</span> : null}
                          </span>
                        ))}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                        {formatMoney(Math.min(...prices), "PKR")}
                        {Math.max(...prices) !== Math.min(...prices) ? ` – ${formatMoney(Math.max(...prices), "PKR")}` : ""}
                      </td>
                      <td className="px-3 py-2 text-xs">{p.csv.status ?? (p.productId ? "unchanged" : "draft")}</td>
                    </tr>
                  );
                })}
                {v.skipped.map((s) => (
                  <tr key={`skip-${s.handle}`} className="border-t border-umber-100 bg-danger-50/40">
                    <td className="px-3 py-2">
                      <span className="font-medium">{s.title}</span>
                      <span className="block text-xs text-umber-500">rows {s.lines.join(", ")}</span>
                    </td>
                    <td className="px-3 py-2" colSpan={4}>
                      <Badge tone="danger">Skipped — fix the errors above</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importable ? (
            <form action={action} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="step" value="confirm" />
              <input type="hidden" name="csv" value={state?.csv ?? ""} />
              <Submit>
                Import {importable} product{importable === 1 ? "" : "s"}
              </Submit>
              <span className="text-xs text-umber-500">Re-uploading the same file later changes nothing; matching SKUs are updated in place.</span>
            </form>
          ) : (
            <p className="text-sm text-umber-600">{plan.products.length ? "Everything in this file is already up to date." : "Nothing to import yet."}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
