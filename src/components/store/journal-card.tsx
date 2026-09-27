import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { JournalCard as JournalCardData } from "@/lib/queries/storefront";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";
import { IllustrationTag, isSvg } from "./illustration-tag";

export function readingMinutes(body: string) {
  return Math.max(1, Math.round(body.split(/\s+/).length / 220));
}

export function JournalCard({ post, className, tone = "light", size = "md" }: { post: JournalCardData; className?: string; tone?: "light" | "dark"; size?: "md" | "lg" }) {
  const dark = tone === "dark";
  return (
    <article className={cn("group relative", className)}>
      <div className={cn("relative overflow-hidden rounded-[var(--radius-card)] bg-sand-200", size === "lg" ? "aspect-[16/10]" : "aspect-[3/2]")}>
        {post.coverImageUrl ? (
          <Image
            src={post.coverImageUrl}
            alt=""
            fill
            sizes={size === "lg" ? "(min-width:1024px) 60vw, 100vw" : "(min-width:1024px) 30vw, 100vw"}
            unoptimized={isSvg(post.coverImageUrl)}
            className="object-cover transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
          />
        ) : (
          <div className="night absolute inset-0" />
        )}
        {isSvg(post.coverImageUrl) ? <IllustrationTag className="absolute right-3 bottom-3" /> : null}
      </div>
      <div className="mt-4">
        <p className={cn("text-xs font-semibold tracking-[0.18em] uppercase", dark ? "text-gold-300" : "text-gold-600")}>
          {post.categoryName ?? "Journal"} · {readingMinutes(post.body)} min read
        </p>
        <h3 className={cn("mt-2 font-display leading-snug", size === "lg" ? "text-3xl md:text-4xl" : "text-xl", dark ? "text-sand-50" : "text-umber-900")}>
          <Link href={`/journal/${post.slug}`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
          <ArrowUpRight className={cn("ml-1 inline size-4 opacity-0 transition group-hover:opacity-100", dark ? "text-gold-300" : "text-terracotta-600")} aria-hidden />
        </h3>
        {post.excerpt ? <p className={cn("mt-2 line-clamp-3 text-sm leading-relaxed", dark ? "text-sand-200/75" : "text-umber-600", size === "lg" && "text-base")}>{post.excerpt}</p> : null}
        <p className={cn("mt-3 text-xs", dark ? "text-sand-200/50" : "text-umber-400")}>{formatDate(post.publishedAt)}</p>
      </div>
    </article>
  );
}
