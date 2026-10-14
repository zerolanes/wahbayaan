"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

const Wordmark3D = dynamic(() => import("./wordmark-3d"), { ssr: false });

function canUse3D() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Hero centrepiece. The static wordmark (real text, vector-crisp) paints
 * instantly and is the fallback for no-WebGL, reduced motion and Save-Data.
 * Otherwise the 3D wordmark loads on the first interaction (then when idle)
 * and cross-fades in once its first frame is drawn. The 3D pauses offscreen.
 */
export function HeroWordmark({ className }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (!canUse3D()) return;
    // The 3D bundle (three.js, ~1 MB unpacked) loads on the visitor's first
    // interaction — a pointer move, touch, scroll or key — then when the browser
    // is idle. Until then the static wordmark (same navy letters) shows, so the
    // first paint and first input stay fast, and nobody downloads 3D they never see.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const events = ["pointermove", "pointerdown", "touchstart", "wheel", "scroll", "keydown"] as const;
    const start = () => {
      events.forEach((e) => window.removeEventListener(e, start));
      if (w.requestIdleCallback) w.requestIdleCallback(() => setLoad(true), { timeout: 800 });
      else window.setTimeout(() => setLoad(true), 100);
    };
    events.forEach((e) => window.addEventListener(e, start, { passive: true, once: true }));
    return () => events.forEach((e) => window.removeEventListener(e, start));
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} className={cn("relative mx-auto aspect-[2.3/1] w-full max-w-5xl sm:aspect-[3/1]", className)}>
      <h1
        className={cn(
          "wordmark-static absolute inset-0 grid place-items-center transition-opacity duration-700",
          ready ? "opacity-0" : "opacity-100",
        )}
      >
        Wahbayaan
      </h1>
      {load ? (
        <div className={cn("absolute inset-0 transition-opacity duration-1000", ready ? "opacity-100" : "opacity-0")}>
          <Wordmark3D running={visible} onReady={onReady} />
        </div>
      ) : null}
    </div>
  );
}
