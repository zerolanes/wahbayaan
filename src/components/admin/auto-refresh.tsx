"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the current server page every `seconds` while the tab is visible. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [at, setAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible" && Date.now() - at >= seconds * 1000) {
        router.refresh();
        setAt(Date.now());
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [at, seconds, router]);
  const left = Math.max(0, seconds - Math.floor((now - at) / 1000));
  return (
    <span className="inline-flex items-center gap-2 text-xs text-umber-500" aria-live="off">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-600 opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-success-600" />
      </span>
      Auto-refresh · next in {left}s
    </span>
  );
}
