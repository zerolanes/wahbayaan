"use client";

import Image from "next/image";
import { SHOW_QA_LABELS } from "@/lib/qa";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Film, Images, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type GalleryImage = { url: string; alt: string | null; kind: "photo" | "illustration" };
type Mode = "photos" | "video";

const isSvg = (url: string) => url.split("?")[0].endsWith(".svg");

/**
 * Product media: photos with hover-zoom and a full-screen lightbox, plus the
 * artisan's process video when there is one.
 */
export function ProductGallery({
  images,
  title,
  videoUrl,
}: {
  images: GalleryImage[];
  title: string;
  videoUrl: string | null;
}) {
  const [mode, setMode] = useState<Mode>("photos");
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [origin, setOrigin] = useState<string | null>(null);
  const current = images[index] ?? images[0];
  const go = useCallback((d: number) => setIndex((i) => (i + d + images.length) % images.length), [images.length]);

  const tabs: { id: Mode; label: string; icon: typeof Images }[] = [
    { id: "photos", label: images.some((i) => i.kind === "photo") ? "Photos" : "Images", icon: Images },
    ...(videoUrl ? [{ id: "video" as const, label: "Process video", icon: Film }] : []),
  ];

  return (
    <div>
      {tabs.length > 1 ? (
        <div role="tablist" aria-label="Product media" className="mb-4 inline-flex rounded-full bg-umber-900/[0.06] p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={mode === t.id}
              aria-controls="product-stage"
              onClick={() => setMode(t.id)}
              className={cn(
                "pressable inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium",
                mode === t.id ? "bg-white text-umber-900 shadow-[0_1px_2px_rgb(34_26_19/0.1),0_2px_8px_-2px_rgb(34_26_19/0.12)]" : "text-umber-700 hover:text-umber-900",
              )}
            >
              <t.icon className="size-4" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      <div id="product-stage" role="tabpanel" className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-panel)] bg-sand-200 shadow-soft">
        {mode === "photos" && current ? (
          <>
            <button
              type="button"
              className="group absolute inset-0 block cursor-zoom-in overflow-hidden"
              onClick={() => setLightbox(true)}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
              }}
              onMouseLeave={() => setOrigin(null)}
              aria-label={`Enlarge image ${index + 1} of ${images.length}`}
            >
              {images.map((img, i) => (
                <Image
                  key={img.url}
                  src={img.url}
                  alt={img.alt ?? title}
                  fill
                  priority={i === 0}
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  unoptimized={isSvg(img.url)}
                  style={i === index && origin ? { transformOrigin: origin } : undefined}
                  className={cn(
                    "object-cover transition-[opacity,transform] duration-500 ease-[var(--ease-out-expo)]",
                    i === index ? "opacity-100" : "opacity-0",
                    i === index && origin ? "scale-[1.8]" : "scale-100",
                  )}
                />
              ))}
            </button>
            <span className="glass-thin pointer-events-none absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-umber-900 max-sm:hidden">
              <ZoomIn className="size-3.5" aria-hidden /> Hover to zoom · click to enlarge
            </span>
            {SHOW_QA_LABELS && current.kind === "illustration" ? (
              <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white/90 backdrop-blur">
                Illustration<span className="max-sm:hidden"> — not a photograph of this piece</span>
              </span>
            ) : null}
            {images.length > 1 ? (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous image" className="glass-thin pressable absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full text-umber-900">
                  <ChevronLeft className="size-5" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next image" className="glass-thin pressable absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full text-umber-900">
                  <ChevronRight className="size-5" />
                </button>
              </>
            ) : null}
          </>
        ) : null}

        {mode === "video" && videoUrl ? (
          <video src={videoUrl} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full bg-black object-contain">
            <track kind="captions" />
          </video>
        ) : null}
      </div>

      {images.length > 1 || videoUrl ? (
        <div className="-mx-1 mt-3 flex gap-2.5 overflow-x-auto p-1 scrollbar-none">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => {
                setMode("photos");
                setIndex(i);
              }}
              aria-label={`Show image ${i + 1}`}
              aria-current={mode === "photos" && i === index ? "true" : undefined}
              className={cn(
                "pressable relative size-18 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-sand-200 md:size-22",
                mode === "photos" && i === index ? "ring-2 ring-indigo-900 ring-offset-2 ring-offset-parchment" : "opacity-80 ring-1 ring-umber-900/10 hover:opacity-100",
              )}
            >
              <Image src={img.url} alt="" fill sizes="96px" unoptimized={isSvg(img.url)} className="object-cover" />
            </button>
          ))}
          {videoUrl ? (
            <button
              type="button"
              onClick={() => setMode("video")}
              className={cn(
                "pressable grid size-18 shrink-0 place-items-center rounded-[var(--radius-control)] bg-umber-900 text-xs font-medium text-sand-50 md:size-22",
                mode === "video" ? "ring-2 ring-indigo-900 ring-offset-2 ring-offset-parchment" : "opacity-90 hover:opacity-100",
              )}
            >
              <span className="flex flex-col items-center gap-1">
                <Film className="size-5" aria-hidden />
                Video
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      {lightbox && current ? <Lightbox images={images} index={index} setIndex={setIndex} title={title} onClose={() => setLightbox(false)} /> : null}
    </div>
  );
}

function Lightbox({ images, index, setIndex, title, onClose }: { images: GalleryImage[]; index: number; setIndex: (fn: (i: number) => number) => void; title: string; onClose: () => void }) {
  const [zoom, setZoom] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const img = images[index];

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + images.length) % images.length);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      prev?.focus();
    };
  }, [images.length, onClose, setIndex]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`${title} — image ${index + 1} of ${images.length}`} className="fixed inset-0 z-[100] flex flex-col bg-indigo-950/95 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-3 text-sand-100 sm:px-6">
        <p className="truncate text-sm">
          <span className="tabular-nums">
            {index + 1} / {images.length}
          </span>{" "}
          · {title}
          {SHOW_QA_LABELS && img.kind === "illustration" ? <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px]">Illustration</span> : null}
        </p>
        <button ref={closeRef} type="button" onClick={onClose} className="pressable inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm hover:bg-white/20">
          <X className="size-4" aria-hidden /> Close
        </button>
      </div>
      <button
        type="button"
        className={cn("relative mx-auto mb-4 w-full max-w-6xl flex-1 overflow-hidden", zoom ? "cursor-zoom-out" : "cursor-zoom-in")}
        onClick={(e) => {
          if (zoom) return setZoom(null);
          const r = e.currentTarget.getBoundingClientRect();
          setZoom(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
        }}
        onMouseMove={(e) => {
          if (!zoom) return;
          const r = e.currentTarget.getBoundingClientRect();
          setZoom(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
        }}
        aria-label={zoom ? "Zoom out" : "Zoom in"}
      >
        <Image
          src={img.url}
          alt={img.alt ?? title}
          fill
          sizes="100vw"
          unoptimized={isSvg(img.url)}
          style={zoom ? { transformOrigin: zoom } : undefined}
          className={cn("object-contain transition-transform duration-300", zoom ? "scale-[2.2]" : "scale-100")}
        />
      </button>
      {images.length > 1 ? (
        <div className="flex items-center justify-center gap-3 pb-6">
          <button type="button" onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)} aria-label="Previous image" className="grid size-11 place-items-center rounded-full border border-white/20 text-sand-50 hover:bg-white/10">
            <ChevronLeft className="size-5" />
          </button>
          <Expand className="size-4 text-sand-200/40" aria-hidden />
          <button type="button" onClick={() => setIndex((i) => (i + 1) % images.length)} aria-label="Next image" className="grid size-11 place-items-center rounded-full border border-white/20 text-sand-50 hover:bg-white/10">
            <ChevronRight className="size-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
