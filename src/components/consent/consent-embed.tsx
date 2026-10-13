"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { grantGroup } from "@/lib/consent/client";
import { parseVideoUrl } from "@/lib/consent/embeds";
import { cn } from "@/lib/utils/cn";
import { useConsent } from "./consent-manager";

/**
 * Click-to-load wrapper for third-party video (Functional group, service
 * "YouTube/Vimeo"). Nothing is requested from the provider — not even a
 * thumbnail — until the visitor loads the video once or allows media.
 */
export function ConsentEmbed({ url, title, className, fill = false }: { url: string; title: string; className?: string; /** Fill a positioned parent instead of a 16:9 card. */ fill?: boolean }) {
  const snap = useConsent();
  const [once, setOnce] = useState(false);
  const video = parseVideoUrl(url);
  if (!video) return null;
  const allowed = once || !!snap.state?.categories.functional;
  return (
    <div className={cn("overflow-hidden bg-indigo-950", fill ? "absolute inset-0" : "relative aspect-video w-full rounded-[var(--radius-card)]", className)} data-consent-embed={video.provider}>
      {allowed ? (
        <iframe
          src={video.embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_center,rgb(40_58_112/0.55),rgb(13_17_36/0.96))] p-4 text-center text-sand-50">
          <div className="flex max-w-md flex-col items-center gap-3">
            <span className="grid size-16 place-items-center rounded-full bg-sand-50/15 ring-1 ring-sand-50/30" aria-hidden>
              <Play className="ml-1 size-7 fill-current" />
            </span>
            <p className="text-sm leading-snug text-sand-100">This video is hosted by a third-party service that may set cookies.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => setOnce(true)} className="pressable inline-flex h-10 items-center rounded-full bg-sand-50 px-4 text-sm font-medium text-indigo-950 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300">
                Load video
              </button>
              <button type="button" onClick={() => grantGroup("functional")} className="pressable inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-sand-50 ring-1 ring-sand-50/40 hover:bg-sand-50/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300">
                Always allow media
              </button>
            </div>
            <p className="text-xs text-sand-100/80">{video.label}</p>
          </div>
        </div>
      )}
    </div>
  );
}
