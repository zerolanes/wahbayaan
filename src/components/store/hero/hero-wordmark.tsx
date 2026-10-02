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
 * Otherwise the 3D wordmark loads after first paint, when the browser is idle,
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
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const start = () => setLoad(true);
    const id = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 1500 }) : window.setTimeout(start, 300);
    return () => {
      if (!w.requestIdleCallback) window.clearTimeout(id);
    };
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
