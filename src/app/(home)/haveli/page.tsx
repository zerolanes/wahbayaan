import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { HomeExperience, type HomeChapter } from "@/components/three/home/home-experience";
import type { ArtKind3d } from "@/components/three/heritage/textures";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";
import { getPublicCategories } from "@/lib/queries/catalog";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Walk through the haveli",
  description: "An interactive walk through a Mughal-era courtyard house, one craft in every room.",
};

const KIND_BY_SLUG: Record<string, [ArtKind3d, number]> = {
  "calligraphy-art": ["calligraphy", 8],
  paintings: ["truckart", 1],
  rugs: ["rug", 4],
  "sculpture-stone": ["stone", 2],
  "wall-decor": ["pottery", 3],
  "posters-prints": ["print", 1],
  "salt-art": ["salt", 3],
  bespoke: ["wood", 1],
};
const FALLBACK_KINDS: ArtKind3d[] = ["calligraphy", "rug", "pottery", "stone", "salt", "wood", "truckart", "print", "ajrak", "tile"];

/** Pick the 3D piece for a craft: known crafts get their object; others follow their cover art. */
function pieceFor(slug: string, coverUrl: string | null, index: number): [ArtKind3d, number] {
  if (KIND_BY_SLUG[slug]) return KIND_BY_SLUG[slug];
  const m = coverUrl?.match(/^\/art\/([a-z]+)\/(\d+)/);
  if (m && FALLBACK_KINDS.includes(m[1] as ArtKind3d)) return [m[1] as ArtKind3d, Number(m[2])];
  return [FALLBACK_KINDS[index % FALLBACK_KINDS.length], index + 1];
}

export default async function HaveliPage() {
  const [categories, home] = await Promise.all([getPublicCategories(), getSetting("home")]);
  const chapters: HomeChapter[] = categories.map((c, i) => {
    const [kind, seed] = pieceFor(c.slug, c.coverImageUrl, i);
    return { slug: c.slug, name: c.name, tagline: c.tagline, count: c.productCount, kind, seed, coverImageUrl: c.coverImageUrl! };
  });

  return (
    <>
      <HomeExperience chapters={chapters} hero={{ eyebrow: home.heroEyebrow, title: home.heroTitle, subtitle: home.heroSubtitle }} />

      <div id="after-tour" className="paper">
        <section className="py-20">
          <Container className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-semibold tracking-[0.22em] text-terracotta-600 uppercase">Leaving the haveli</p>
              <h2 className="mt-3 font-display text-4xl leading-tight text-umber-900">Every room you walked through is for sale.</h2>
              <p className="mt-3 text-umber-600">Browse the full collection, or meet the families and workshops who make it.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/shop">
                Shop the collection <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="/" variant="outline">
                Back to the homepage
              </ButtonLink>
            </div>
          </Container>
        </section>
      </div>
    </>
  );
}
