"use client";

import { useEffect } from "react";

/**
 * Loads the Noto Nastaliq Urdu font faces once the page has finished loading
 * (then when the browser is idle). Urdu accent lines stay on the page from the
 * start in the system's Arabic-script font and swap to Nastaliq when it lands;
 * Inter and Fraunces stay the only render-critical fonts.
 */
export function UrduFont() {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const load = () => {
      const run = () => void import("./urdu-font-faces");
      if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 2000 });
      else window.setTimeout(run, 200);
    };
    if (document.readyState === "complete") load();
    else window.addEventListener("load", load, { once: true });
    return () => window.removeEventListener("load", load);
  }, []);
  return null;
}
