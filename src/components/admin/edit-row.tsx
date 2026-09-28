"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * A table row with an inline editor that opens underneath it. The cells and the
 * editor are rendered on the server and passed in, so the table stays a server
 * component; only the open/closed state lives here.
 */
export function EditRow({ cells, editor, colSpan, label = "Edit", defaultOpen = false, className }: { cells: ReactNode; editor: ReactNode; colSpan: number; label?: string; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <tr className={cn("transition hover:bg-umber-50", open && "bg-umber-50", className)}>
        {cells}
        <td className="px-4 py-2 text-right align-middle whitespace-nowrap">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-umber-200 bg-white px-2 text-xs font-medium text-umber-700 hover:border-umber-300 hover:text-umber-900"
          >
            {open ? <ChevronDown className="size-3.5 rotate-180" /> : <Pencil className="size-3" />}
            {open ? "Close" : label}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="bg-umber-50/70">
          <td colSpan={colSpan + 1} className="border-t border-umber-200/60 px-4 pt-3 pb-4">
            {editor}
          </td>
        </tr>
      ) : null}
    </>
  );
}
