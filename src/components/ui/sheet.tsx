"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { materialClass, type Material } from "./glass";

export type SheetSide = "auto" | "bottom" | "right" | "left" | "top" | "center";

/**
 * Modal sheet on the native <dialog> element: top layer (never clipped by a
 * blurred header), focus trap, Escape and inert background come from the
 * browser. Slides in and out along the same path with a spring curve; reduced
 * motion turns it into a cross-fade (globals.css → "Sheet"). Tapping the scrim
 * closes it. Scroll is locked with `html:has(dialog.sheet[open])`.
 */
export function Sheet({
  open,
  onClose,
  side = "auto",
  material = "thick",
  label,
  title,
  description,
  children,
  footer,
  className,
  panelClassName,
  hideClose,
}: {
  open: boolean;
  onClose: () => void;
  side?: SheetSide;
  material?: Material;
  /** Accessible name when there is no visible title. */
  label?: string;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky actions pinned to the bottom of the sheet. */
  footer?: ReactNode;
  className?: string;
  panelClassName?: string;
  hideClose?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Content is mounted only while open (and through the exit transition), so a
  // closed sheet adds nothing to the page: no hidden forms, links or images.
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
    else {
      const t = window.setTimeout(() => setMounted(false), 520);
      return () => window.clearTimeout(t);
    }
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && mounted && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open, mounted]);

  const grabber = side === "bottom" || side === "auto";
  return (
    <dialog
      ref={ref}
      data-side={side}
      className={cn("sheet", className)}
      aria-label={title ? undefined : label}
      aria-labelledby={title ? titleId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => open && onClose()}
      onClick={(e) => {
        // A click on the dialog box itself (not its panel) is a click on the scrim.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {mounted ? (
      <div className={cn("sheet-panel", materialClass[material], panelClassName)}>
        {grabber ? <span className="sheet-grabber shrink-0" aria-hidden /> : null}
        {title || !hideClose ? (
          <div className={cn("flex shrink-0 items-start justify-between gap-4 px-5 pt-4 pb-3 sm:px-6", !title && "absolute top-0 right-0 z-10")}>
            {title ? (
              <div className="min-w-0">
                <h2 id={titleId} className="text-xl text-umber-900">
                  {title}
                </h2>
                {description ? <p className="mt-0.5 text-sm text-umber-700">{description}</p> : null}
              </div>
            ) : null}
            {!hideClose ? <SheetClose onClick={onClose} /> : null}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6">{children}</div>
        {footer ? <div className="shrink-0 border-t border-umber-900/[0.07] px-5 py-4 sm:px-6">{footer}</div> : null}
      </div>
      ) : null}
    </dialog>
  );
}

export function SheetClose({ onClick, label = "Close", className }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn("pressable grid size-10 shrink-0 place-items-center rounded-full bg-umber-900/[0.07] text-umber-800 hover:bg-umber-900/[0.12]", className)}
    >
      <X className="size-[18px]" aria-hidden />
    </button>
  );
}
