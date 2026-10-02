import { BRAND_ART_KINDS, renderBrandArt, type BrandArtKind } from "@/lib/brands/demo-art";

/**
 * GET /brand-art/<kind>/<seed>.svg — garment illustrations for the fictional
 * demo brands; /brand-art/logo/<letters>-<seed>.svg — a demo monogram.
 */
export async function GET(_req: Request, ctx: RouteContext<"/brand-art/[kind]/[file]">) {
  const { kind, file } = await ctx.params;
  const m = /^(?:([A-Za-z]{1,3})-)?(\d{1,9})\.svg$/.exec(file);
  if (!m || !BRAND_ART_KINDS.includes(kind as BrandArtKind)) return new Response("Not found", { status: 404 });
  return new Response(renderBrandArt(kind as BrandArtKind, Number(m[2]), m[1]), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
