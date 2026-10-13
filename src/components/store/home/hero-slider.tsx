"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { HeroWordmark } from "@/components/store/hero/hero-wordmark";
import { cn } from "@/lib/utils/cn";
import { PhoolStrip, PhotoNeeded } from "@/components/store/truck-art";
import art from "@/components/store/truck-art.module.css";
import s from "./home.module.css";

export type HeroSlide = {
  id: string;
  kind: string;
  eyebrow?: string;
  title?: string;
  line: string;
  cta: { label: string; href: string };
  image?: string;
  photoNeeded?: string;
};

const INTERVAL = 9000;

/**
 * Three-slide hero (the old theme's slider, rebuilt): slow parallax between
 * slides, previous / next / dots / pause, swipe on touch. Autoplay pauses on
 * hover, focus and hidden tabs, and never starts under reduced motion.
 */
export function HeroSlider({ slides, label }: { slides: HeroSlide[]; label: string }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [held, setHeld] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = slides.length;
  const go = useCallback((i: number) => setActive(((i % n) + n) % n), [n]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPlaying(!reduce.matches);
    const onChange = () => reduce.matches && setPlaying(false);
    reduce.addEventListener("change", onChange);
    return () => reduce.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!playing || held) return;
    const t = window.setTimeout(() => {
      if (document.visibilityState === "visible") go(active + 1);
    }, INTERVAL);
    return () => window.clearTimeout(t);
  }, [active, playing, held, go]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="px-2 pt-3 sm:px-4 sm:pt-4"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHeld(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(active + 1);
        if (e.key === "ArrowLeft") go(active - 1);
      }}
    >
      <div
        className="relative mx-auto h-[500px] max-w-[1400px] overflow-hidden rounded-[var(--radius-sheet)] bg-white shadow-[0_0_0_1px_var(--wb-line)] lg:h-[600px]"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 48) go(active + (dx < 0 ? 1 : -1));
          touchX.current = null;
        }}
      >
        <div className={s.track} style={{ transform: `translateX(${-active * 100}%)` }} aria-live={playing && !held ? "off" : "polite"}>
          {slides.map((slide, i) => {
            const on = i === active;
            return (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${n}`}
                aria-hidden={!on}
                inert={!on}
                data-active={on}
                className={s.slide}
              >
                {slide.kind === "wordmark" ? (
                  <>
                    <div className={s.slideBg} style={{ transform: `translateX(${(i - active) * -30}%)` }} aria-hidden>
                      <div className="absolute inset-0 bg-[var(--wb-cream)]" />
                    </div>
                    <div className={cn(s.slideContent, "relative flex h-full flex-col items-center justify-center px-4 pb-16 text-center")}>
                      <HeroWordmark className="max-w-4xl" />
                      <p className="-mt-1 text-xl font-medium tracking-[-0.015em] text-[var(--wb-ink)] sm:text-2xl">{slide.line}</p>
                      <Link
                        href={slide.cta.href}
                        className="pressable mt-6 inline-flex h-12 min-w-40 items-center justify-center gap-2 rounded-full bg-[var(--wb-ink)] px-7 text-[0.95rem] font-semibold text-white hover:bg-indigo-900"
                      >
                        {slide.cta.label} <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </div>
                    <PhoolStrip className="absolute inset-x-0 bottom-0 opacity-90" />
                  </>
                ) : (
                  <>
                    <div className={s.slideBg} style={{ transform: `translateX(${(i - active) * -30}%)` }} aria-hidden>
                      {slide.image ? <Image src={slide.image} alt="" fill sizes="100vw" unoptimized className="object-cover" /> : null}
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(13_17_36/0.45),rgb(13_17_36/0.7))]" />
                    </div>
                    <div className={cn(s.slideContent, "relative flex h-full flex-col items-center justify-center px-6 pb-16 text-center text-white")}>
                      {slide.eyebrow ? <p className="text-sm font-medium text-white/80">{slide.eyebrow}</p> : null}
                      <h2 className={cn(art.display, "mt-4 text-[2.6rem] text-white sm:text-6xl lg:text-7xl")}>{slide.title}</h2>
                      <p className="mt-3 max-w-md text-lg text-white/90">{slide.line}</p>
                      <Link
                        href={slide.cta.href}
                        className="pressable mt-7 inline-flex h-12 min-w-40 items-center justify-center gap-2 rounded-full bg-white px-7 text-[0.95rem] font-semibold text-[var(--wb-ink)] hover:bg-sand-100"
                      >
                        {slide.cta.label} <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </div>
                    {slide.photoNeeded ? (
                      <PhotoNeeded dark className="top-3 left-3">
                        {slide.photoNeeded}
                      </PhotoNeeded>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="absolute inset-x-0 bottom-5 z-10 flex justify-center">
          <div className="glass flex items-center gap-0.5 rounded-full p-1 text-[var(--wb-ink)]">
            <button type="button" onClick={() => go(active - 1)} className="pressable grid size-10 place-items-center rounded-full hover:bg-black/[0.06]" aria-label="Previous slide">
              <ChevronLeft className="size-[18px]" aria-hidden />
            </button>
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Slide ${i + 1}: ${slide.title ?? slide.line}`}
                aria-current={i === active ? "true" : undefined}
                className="group grid h-10 w-7 place-items-center rounded-full"
              >
                <span className={cn("h-2 rounded-full transition-all duration-300", i === active ? "w-5 bg-[var(--wb-ink)]" : "w-2 bg-[var(--wb-ink)]/35 group-hover:bg-[var(--wb-ink)]/60")} />
              </button>
            ))}
            <button type="button" onClick={() => go(active + 1)} className="pressable grid size-10 place-items-center rounded-full hover:bg-black/[0.06]" aria-label="Next slide">
              <ChevronRight className="size-[18px]" aria-hidden />
            </button>
            <span className="mx-0.5 h-5 w-px bg-black/10" aria-hidden />
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="pressable grid size-10 place-items-center rounded-full hover:bg-black/[0.06]"
              aria-label={playing ? "Pause slideshow" : "Play slideshow"}
            >
              {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
