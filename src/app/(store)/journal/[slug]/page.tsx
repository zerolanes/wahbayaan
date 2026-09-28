import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TileDivider } from "@/components/brand/logo";
import { IllustrationTag, isSvg } from "@/components/store/illustration-tag";
import { JournalCard, readingMinutes } from "@/components/store/journal-card";
import { Markdown } from "@/components/store/markdown";
import { ProductGrid } from "@/components/store/product-grid";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumbs, Container, SectionHeading } from "@/components/ui/misc";
import { getPublicProducts } from "@/lib/queries/catalog";
import { getJournalPost, getJournalPosts } from "@/lib/queries/storefront";
import { formatDate } from "@/lib/utils/format";

export async function generateMetadata(props: PageProps<"/journal/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = await getJournalPost(slug);
  if (!p) return { title: "Story not found" };
  return {
    title: p.seoTitle ?? p.title,
    description: p.seoDescription ?? p.excerpt ?? undefined,
    openGraph: { type: "article", title: p.title, description: p.excerpt ?? undefined, images: p.coverImageUrl ? [p.coverImageUrl] : undefined },
  };
}

export default async function JournalPostPage(props: PageProps<"/journal/[slug]">) {
  const { slug } = await props.params;
  const post = await getJournalPost(slug);
  if (!post) notFound();
  const [all, products] = await Promise.all([
    getJournalPosts(),
    post.categorySlug ? getPublicProducts({ categorySlug: post.categorySlug, limit: 4, sort: "featured" }) : Promise.resolve({ items: [], total: 0 }),
  ]);
  const more = all.filter((p) => p.id !== post.id).slice(0, 3);

  return (
    <article>
      <header className="pt-10 md:pt-14">
        <Container className="max-w-4xl text-center">
          <Breadcrumbs items={[{ label: "Journal", href: "/journal" }, { label: post.title }]} className="flex justify-center" />
          <p className="mt-8 text-xs font-semibold tracking-[0.22em] text-gold-600 uppercase">
            {post.categorySlug ? (
              <Link href={`/category/${post.categorySlug}`} className="hover:text-gold-800">
                {post.categoryName}
              </Link>
            ) : (
              "Journal"
            )}{" "}
            · {readingMinutes(post.body)} min read
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-5xl leading-[1.04] text-balance text-umber-900 md:text-7xl">{post.title}</h1>
          {post.excerpt ? <p className="mx-auto mt-6 max-w-2xl font-display text-xl text-umber-600 italic md:text-2xl">{post.excerpt}</p> : null}
          <p className="mt-6 text-sm text-umber-500">
            {post.authorName ?? "Wahbayaan"} · {formatDate(post.publishedAt, { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </Container>
        {post.coverImageUrl ? (
          <Container className="mt-12">
            <div className="relative aspect-[16/9] overflow-hidden rounded-[2rem] bg-sand-200 shadow-soft md:aspect-[21/9]">
              <Image src={post.coverImageUrl} alt="" fill priority sizes="100vw" unoptimized={isSvg(post.coverImageUrl)} className="object-cover" />
              {isSvg(post.coverImageUrl) ? <IllustrationTag className="absolute right-4 bottom-4" /> : null}
            </div>
          </Container>
        ) : null}
      </header>

      <Container className="max-w-2xl py-14 md:py-20">
        <Markdown source={post.body} className="first-letter:float-left first-letter:mr-3 first-letter:font-display first-letter:text-7xl first-letter:leading-[0.85] first-letter:text-terracotta-700" />
      </Container>

      {products.items.length ? (
        <section className="py-16 md:py-20">
          <TileDivider />
          <Container className="pt-16 md:pt-20">
            <SectionHeading
              eyebrow="From this craft"
              title={`${post.categoryName} you can bring home`}
              action={
                <ButtonLink href={`/category/${post.categorySlug}`} variant="outline">
                  See all
                </ButtonLink>
              }
            />
            <ProductGrid products={products.items} columns="four" className="mt-10" />
          </Container>
        </section>
      ) : null}

      {more.length ? (
        <section className="border-t border-umber-200/60 py-16 md:py-20">
          <Container>
            <SectionHeading eyebrow="Keep reading" title="More from the journal" />
            <div className="mt-10 grid gap-10 md:grid-cols-3">
              {more.map((p) => (
                <JournalCard key={p.id} post={p} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </article>
  );
}
