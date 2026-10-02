import type { BrandSizeGuide } from "@/lib/db/schema";
import { cn } from "@/lib/utils/cn";

/** The brand's size chart as entered by staff. Without one, we say so rather than guessing measurements. */
export function SizeGuideTable({ guide, brandName, className }: { guide: BrandSizeGuide | null; brandName: string; className?: string }) {
  if (!guide || !guide.rows.length)
    return (
      <p className={cn("text-sm text-umber-600", className)}>
        {brandName}&apos;s size chart hasn&apos;t been added yet. Tell us your usual size in the order notes and we&apos;ll check it against the brand&apos;s chart before ordering.
      </p>
    );
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[420px] text-left text-sm">
        <caption className="mb-2 text-left text-xs text-umber-500">Measurements in {guide.unit === "in" ? "inches" : "centimetres"}, as published by {brandName}.</caption>
        <thead>
          <tr className="border-b border-umber-200">
            <th scope="col" className="py-2 pr-4 font-semibold text-umber-900">
              Size
            </th>
            {guide.columns.map((c) => (
              <th key={c} scope="col" className="py-2 pr-4 font-semibold text-umber-900">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {guide.rows.map((r) => (
            <tr key={r.size} className="border-b border-umber-200/60">
              <th scope="row" className="py-2 pr-4 font-medium text-umber-900">
                {r.size}
              </th>
              {guide.columns.map((c, i) => (
                <td key={c} className="py-2 pr-4 text-umber-700 tabular-nums">
                  {r.values[i] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {guide.note ? <p className="mt-2 text-xs text-umber-500">{guide.note}</p> : null}
    </div>
  );
}
