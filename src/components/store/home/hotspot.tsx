"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import s from "./home.module.css";

/**
 * Shoppable lookbook pin. A 44px button over the image; opens a small solid
 * card (title, maker, price, link) that closes on Escape or an outside tap.
 */
export function Hotspot({ x, y, label, children }: { x: number; y: number; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<{ right: boolean; up: boolean }>({ right: x > 55, up: y > 55 });
  const id = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className={cn("absolute z-[4] -translate-x-1/2 -translate-y-1/2", open && "z-[6]")} style={{ left: `${x}%`, top: `${y}%` }}>
      <button
        type="button"
        onClick={(e) => {
          // Open towards the side with room, so the card never runs off-screen.
          const r = e.currentTarget.getBoundingClientRect();
          setSide({ right: r.left + 232 > window.innerWidth - 8, up: r.bottom + 180 > window.innerHeight && r.top > 200 });
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label} — details`}
        className="pressable grid size-11 place-items-center rounded-full"
      >
        <span className={cn(s.pin, "grid size-7 place-items-center rounded-full bg-white text-[var(--wb-ink)] transition-transform", open && "rotate-45")}>
          <Plus className="size-4" aria-hidden />
        </span>
      </button>
      <div
        id={id}
        hidden={!open}
        className={cn(
          "absolute w-56 rounded-2xl bg-white p-3 text-left text-[var(--wb-ink)] shadow-[0_0_0_1px_var(--wb-line),0_18px_40px_-16px_rgb(34_26_19/0.45)]",
          side.up ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
          side.right ? "right-0" : "left-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}
