import "server-only";
import { sql } from "drizzle-orm";
import { query } from "./sql";

export type MediaUse = { kind: string; label: string; href: string | null };

/**
 * Where uploaded files are referenced: every image/video column and JSON URL
 * list in the schema, plus markdown bodies (journal, pages) and 3D model
 * metadata. Used to show usage and to refuse deleting a file that is in use.
 */
export async function mediaUsage(urls: readonly string[]): Promise<Map<string, MediaUse[]>> {
  const out = new Map<string, MediaUse[]>();
  if (!urls.length) return out;
  const list = [...new Set(urls)];
  const rows = await query<{ url: string; kind: string; label: string; ref: string | null }>(sql`
    select * from (
      select cover_image_url as url, 'Category cover' as kind, name as label, id::text as ref from categories
      union all select profile_photo_url, 'Artisan portrait', display_name, id::text from vendors
      union all select banner_url, 'Artisan banner', display_name, id::text from vendors
      union all select story_video_url, 'Artisan video', display_name, id::text from vendors
      union all select pi.url, 'Listing image', p.title, p.id::text from product_images pi join products p on p.id = pi.product_id
      union all select video_url, 'Listing video', title, id::text from products
      union all select rp.url, 'Review photo', r.title, r.product_id::text from review_photos rp join reviews r on r.id = rp.review_id
      union all select cover_image_url, 'Collection cover', title, id::text from collections
      union all select cover_image_url, 'Journal cover', title, id::text from journal_posts
      union all select avatar_url, 'User avatar', name, id::text from users
      union all select image_url, 'Order line', title, order_id::text from order_items
      union all select jsonb_array_elements_text(sample_photo_urls), 'Application sample', full_name, id::text from vendor_applications
      union all select jsonb_array_elements_text(evidence_urls), 'Dispute evidence', number, number from disputes
      union all select jsonb_array_elements_text(reference_image_urls), 'Custom request reference', number, number from custom_requests
      union all select m.url, 'Journal body', j.title, j.id::text from journal_posts j join media m on position(m.url in j.body) > 0
      union all select m.url, 'Page body', pg.title, pg.slug from pages pg join media m on position(m.url in pg.body) > 0
      union all select m.url, 'Listing 3D model', p.title, p.id::text from products p join media m on p.model_3d is not null and position(m.url in p.model_3d::text) > 0
    ) u where u.url in ${list}
  `);
  for (const r of rows) {
    const uses = out.get(r.url) ?? [];
    uses.push({ kind: r.kind, label: r.label ?? "", href: hrefFor(r.kind, r.ref) });
    out.set(r.url, uses);
  }
  return out;
}

function hrefFor(kind: string, ref: string | null): string | null {
  if (!ref) return null;
  if (kind.startsWith("Artisan")) return `/admin/artisans/${ref}`;
  if (kind.startsWith("Listing") || kind === "Review photo") return `/admin/listings/${ref}`;
  if (kind === "Category cover") return `/admin/categories#${ref}`;
  if (kind === "Collection cover") return `/admin/collections/${ref}`;
  if (kind.startsWith("Journal")) return `/admin/content/journal/${ref}`;
  if (kind === "Page body") return `/admin/content/pages?edit=${ref}`;
  if (kind === "Application sample") return `/admin/applications/${ref}`;
  if (kind === "Dispute evidence") return `/admin/disputes/${ref}`;
  if (kind === "Custom request reference") return `/admin/requests?q=${ref}`;
  if (kind === "User avatar") return `/admin/customers/${ref}`;
  return null;
}
