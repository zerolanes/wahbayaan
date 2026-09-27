"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Chapter } from "./haveli-scene";
import { scrollState } from "./scroll-store";

const HaveliCanvas = dynamic(() => import("./haveli-scene"), { ssr: false });

export type HomeChapter = Chapter & { coverImageUrl: string };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function detectWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * The 3D homepage: a scroll-driven walk through a haveli courtyard at dusk,
 * one floating heritage piece per craft. All text lives in real HTML over the
 * canvas, so it stays readable, linkable and indexable.
 */
export function HomeExperience({
  chapters,
  hero,
}: {
  chapters: HomeChapter[];
  hero: { eyebrow: string; title: string; subtitle: string };
}) {
  const container = useRef<HTMLElement>(null);
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(-1);
  const [running, setRunning] = useState(true);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [lowDetail, setLowDetail] = useState(false);
  const n = chapters.length;

  useEffect(() => {
    setWebgl(detectWebGL());
    setLowDetail(window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4);
  }, []);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      scrollState.progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
    };
    const onPointer = (e: PointerEvent) => {
      scrollState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      scrollState.pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("pointermove", onPointer, { passive: true });
    const io = new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointermove", onPointer);
      io.disconnect();
    };
  }, []);

  const scrollToStage = useCallback(
    (stage: number) => {
      const el = container.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const total = el.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + (total * (stage + 1)) / (n + 1), behavior: reducedMotion ? "instant" : "smooth" });
    },
    [n, reducedMotion],
  );

  const onSelect = useCallback((slug: string) => router.push(`/category/${slug}`), [router]);
  const onActive = useCallback((i: number) => setActive(i), []);

  return (
    <section ref={container} aria-label="A walk through the crafts" data-active={active} className="relative bg-indigo-950" style={{ height: `${(n + 2) * 100}vh` }}>
      <div className="sticky top-0 h-dvh w-full overflow-hidden">
        {/* Scene */}
        <div className="absolute inset-0" aria-hidden>
          {webgl === false ? (
            <div className="grid h-full grid-cols-4 opacity-60">
              {chapters.map((c) => (
                <div key={c.slug} className="relative">
                  <Image src={c.coverImageUrl} alt="" fill unoptimized className="object-cover" />
                </div>
              ))}
            </div>
          ) : webgl ? (
            <HaveliCanvas chapters={chapters} lowDetail={lowDetail} reducedMotion={reducedMotion} running={running} onSelect={onSelect} onActive={onActive} />
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-950/55 via-transparent to-indigo-950/70" />
        </div>

        {/* Intro */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 flex items-end pb-[14vh] transition-all duration-700 ease-[var(--ease-out-expo)] md:items-center md:pb-0",
            active === -1 ? "opacity-100" : "translate-y-6 opacity-0",
          )}
        >
          <div className={cn("mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12", active === -1 && "pointer-events-auto")}>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-gold-300 uppercase">{hero.eyebrow}</p>
            <h1 className="mt-5 max-w-4xl font-display text-[3.2rem] leading-[0.98] text-sand-50 drop-shadow-[0_2px_24px_rgb(0_0_0/0.45)] sm:text-7xl lg:text-[6.5rem]">
              {hero.title}
            </h1>
            <p className="mt-6 max-w-xl text-base text-sand-100/85 sm:text-lg">{hero.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => scrollToStage(0)}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-b from-gold-300 to-gold-500 px-6 font-medium text-ink shadow-glow transition hover:from-gold-200 hover:to-gold-400"
              >
                Walk through the crafts <ArrowDown className="size-4" />
              </button>
              <Link href="/shop" className="inline-flex h-12 items-center rounded-full border border-white/25 bg-white/10 px-6 font-medium text-sand-50 backdrop-blur transition hover:bg-white/20">
                Shop all pieces
              </Link>
            </div>
          </div>
        </div>

        {/* Chapters */}
        {chapters.map((c, i) => {
          const right = i % 2 === 1; // piece is on the left for odd chapters → text on the right
          return (
            <div
              key={c.slug}
              className={cn(
                "pointer-events-none absolute inset-0 flex items-end pb-8 transition-all duration-700 ease-[var(--ease-out-expo)] md:items-center md:pb-0",
                active === i ? "opacity-100" : "translate-y-8 opacity-0",
              )}
              aria-hidden={active !== i}
            >
              <div className={cn("mx-auto flex w-full max-w-[1400px] px-4 sm:px-8 lg:px-12", right ? "md:justify-end" : "md:justify-start")}>
                <div className={cn("w-full max-w-md rounded-3xl border border-white/10 bg-indigo-950/45 p-6 backdrop-blur-md sm:p-8", active === i && "pointer-events-auto")}>
                  <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.28em] text-gold-300 uppercase">
                    <span className="tabular-nums">
                      {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-r from-gold-400/60 to-transparent" />
                  </p>
                  <h2 className="mt-4 font-display text-4xl leading-[1.02] text-sand-50 sm:text-5xl">{c.name}</h2>
                  {c.tagline ? <p className="mt-3 text-sand-100/80">{c.tagline}</p> : null}
                  <p className="mt-4 text-sm text-sand-200/60">
                    {c.count > 0 ? `${c.count} ${c.count === 1 ? "piece" : "pieces"} from verified artisans` : "New pieces arriving from our artisans"}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <Link
                      href={`/category/${c.slug}`}
                      tabIndex={active === i ? 0 : -1}
                      className="inline-flex h-11 items-center gap-2 rounded-full bg-sand-50 px-5 text-sm font-medium text-ink transition hover:bg-gold-100"
                    >
                      {c.count > 0 ? `View ${c.count} ${c.count === 1 ? "piece" : "pieces"}` : "Explore the craft"} <ArrowRight className="size-4" />
                    </Link>
                    <span className="hidden items-center gap-1.5 text-xs text-sand-200/50 md:flex">
                      <MousePointerClick className="size-3.5" /> or click the piece
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Outro */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 flex items-end justify-center pb-[12vh] text-center transition-all duration-500 ease-[var(--ease-out-expo)]",
            active === n ? "opacity-100" : "translate-y-8 opacity-0",
          )}
        >
          <div className={cn("relative max-w-2xl px-6", active === n && "pointer-events-auto")}>
            <div className="absolute -inset-x-16 -inset-y-20 -z-10 rounded-full bg-[radial-gradient(ellipse_at_center,rgb(13_17_36/0.82),transparent_70%)]" />
            <p className="text-[11px] font-semibold tracking-[0.3em] text-gold-300 uppercase">The marketplace</p>
            <h2 className="mt-4 font-display text-5xl leading-[1.02] text-sand-50 sm:text-7xl">Every piece carries a maker&apos;s name.</h2>
            <p className="mx-auto mt-5 max-w-lg text-sand-100/80">Verified artisans. The full landed cost before you pay. Your payment held until it arrives.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/shop" tabIndex={active === n ? 0 : -1} className="inline-flex h-12 items-center rounded-full bg-gradient-to-b from-gold-300 to-gold-500 px-7 font-medium text-ink shadow-glow">
                Enter the marketplace
              </Link>
              <Link href="/artisans" tabIndex={active === n ? 0 : -1} className="inline-flex h-12 items-center rounded-full border border-white/25 bg-white/10 px-7 font-medium text-sand-50 backdrop-blur">
                Meet the artisans
              </Link>
            </div>
          </div>
        </div>

        {/* Progress rail */}
        <nav aria-label="Crafts" className="absolute top-1/2 right-4 hidden -translate-y-1/2 flex-col items-end gap-2.5 md:flex lg:right-8">
          {chapters.map((c, i) => (
            <button key={c.slug} type="button" onClick={() => scrollToStage(i)} className="group flex items-center gap-3" aria-label={`Go to ${c.name}`} aria-current={active === i ? "step" : undefined}>
              <span className={cn("text-xs text-sand-100 opacity-0 transition group-hover:opacity-100", active === i && "opacity-100")}>{c.name}</span>
              <span className={cn("block h-[2px] rounded-full transition-all duration-500", active === i ? "w-8 bg-gold-300" : "w-4 bg-white/35 group-hover:w-6 group-hover:bg-white/70")} />
            </button>
          ))}
        </nav>

        {/* Scroll cue + skip */}
        <div className={cn("absolute inset-x-0 bottom-5 flex justify-center transition-opacity duration-500", active === -1 ? "opacity-100" : "opacity-0")}>
          <span className="flex flex-col items-center gap-2 text-[11px] tracking-[0.25em] text-sand-200/70 uppercase">
            Scroll to enter the haveli
            <span className="h-8 w-px animate-pulse bg-gradient-to-b from-gold-300 to-transparent" />
          </span>
        </div>
        <a href="#after-tour" className="sr-only rounded-full bg-sand-50 px-4 py-2 text-sm text-ink focus:not-sr-only focus:absolute focus:top-20 focus:left-4">
          Skip the 3D tour
        </a>
      </div>
    </section>
  );
}
