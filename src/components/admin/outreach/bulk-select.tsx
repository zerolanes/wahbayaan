"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button";

/**
 * Bulk send picker: row checkboxes join this GET form through the `form`
 * attribute; it opens the preview page for the selected contacts (max `limit`).
 */
export function OutreachBulkSelect({ formId, templates, limit }: { formId: string; templates: { id: string; name: string }[]; limit: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(document.querySelectorAll(`input[form="${formId}"][data-row]:checked`).length);
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
  }, [formId]);
  const over = count > limit;
  return (
    <form id={formId} method="get" action="/admin/outreach/send" className="flex flex-wrap items-center gap-2">
      <span className={over ? "text-sm font-medium text-danger-700 tabular-nums" : "text-sm text-umber-500 tabular-nums"}>
        {count} selected{over ? ` — max ${limit}` : ""}
      </span>
      <select name="template" aria-label="Template" className="h-8 max-w-48 rounded-full border border-umber-200 bg-white/90 pr-7 pl-3 text-sm text-umber-900 focus:border-gold-500 focus:outline-none">
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={count === 0 || over || !templates.length} className={buttonClass("outline", "sm")}>
        Preview &amp; send
      </button>
    </form>
  );
}

export function OutreachSelectAll({ formId, limit }: { formId: string; limit: number }) {
  return (
    <input
      type="checkbox"
      aria-label={`Select the first ${limit} rows`}
      title={`Selects the first ${limit} rows that have an email`}
      className="size-4 accent-indigo-800"
      onChange={(e) => {
        const boxes = [...document.querySelectorAll<HTMLInputElement>(`input[form="${formId}"][data-row]`)];
        boxes.forEach((i) => (i.checked = false));
        if (e.target.checked) boxes.filter((i) => !i.disabled).slice(0, limit).forEach((i) => (i.checked = true));
        document.dispatchEvent(new Event("change"));
      }}
    />
  );
}
