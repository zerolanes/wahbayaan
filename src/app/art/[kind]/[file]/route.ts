import { ART_KINDS, renderArt, type ArtKind } from "@/lib/art/generators";
import { renderSurface } from "@/lib/art/surfaces";

const SIZES = {
  portrait: { w: 1200, h: 1500 },
  wide: { w: 1600, h: 1000 },
  square: { w: 1200, h: 1200 },
  banner: { w: 2000, h: 700 },
  avatar: { w: 480, h: 480 },
} as const;

/**
 * GET /art/<kind>/<seed>[-<size>].svg — deterministic procedural illustration.
 * e.g. /art/rug/12.svg, /art/calligraphy/3-wide.svg
 */
export async function GET(_req: Request, ctx: RouteContext<"/art/[kind]/[file]">) {
  const { kind, file } = await ctx.params;
  const match = /^(\d{1,9})(?:-(portrait|wide|square|banner|avatar|surface))?\.svg$/.exec(file);
  if (!match || !ART_KINDS.includes(kind as ArtKind)) return new Response("Not found", { status: 404 });
  const seed = Number(match[1]);
  const variant = match[2];
  const svg =
    variant === "surface"
      ? renderSurface(kind as ArtKind, seed)
      : renderArt(kind as ArtKind, seed, variant ? SIZES[variant as keyof typeof SIZES] : undefined);
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; font-src data:",
    },
  });
}
