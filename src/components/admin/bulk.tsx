"use client";

import { useEffect, useState } from "react";
import type { AdminAction } from "@/lib/admin/action-state";
import { Select } from "@/components/ui/form";
import { ActionForm, SubmitButton } from "./action-form";

/**
 * Bulk actions for a table. Row checkboxes live anywhere on the page and join
 * this form through the HTML `form` attribute, so the table stays a server
 * component.
 */
export function BulkBar({
  formId,
  action,
  options,
  hidden,
}: {
  formId: string;
  action: AdminAction;
  options: { value: string; label: string; confirm?: string }[];
  hidden?: Record<string, string>;
}) {
  const [count, setCount] = useState(0);
  const [op, setOp] = useState(options[0]?.value ?? "");
  useEffect(() => {
    const update = () => setCount(document.querySelectorAll(`input[form="${formId}"][data-row]:checked`).length);
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
  }, [formId]);
  const confirm = options.find((o) => o.value === op)?.confirm;
  return (
    <ActionForm
      id={formId}
      action={action}
      className="flex flex-wrap items-center gap-2"
      confirm={confirm ? `${confirm} (${count} selected)` : undefined}
      onResult={(s) => {
        if (s?.ok) {
          document.querySelectorAll<HTMLInputElement>(`input[form="${formId}"]`).forEach((i) => (i.checked = false));
          setCount(0);
        }
      }}
    >
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <span className="text-sm text-umber-500 tabular-nums">{count} selected</span>
      <Select name="op" value={op} onChange={(e) => setOp(e.target.value)} className="h-8 w-auto rounded-full py-0 pr-8 pl-3 text-sm" aria-label="Bulk action">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <SubmitButton variant="outline" disabled={count === 0}>
        Apply
      </SubmitButton>
    </ActionForm>
  );
}

export function SelectAll({ formId }: { formId: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Select all rows"
      className="size-4 accent-indigo-800"
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>(`input[form="${formId}"][data-row]`).forEach((i) => (i.checked = e.target.checked));
        document.dispatchEvent(new Event("change"));
      }}
    />
  );
}

export function RowCheck({ formId, value, label }: { formId: string; value: string; label?: string }) {
  return <input type="checkbox" name="ids[]" value={value} form={formId} data-row aria-label={label ?? "Select row"} className="size-4 accent-indigo-800" />;
}
