/** Header search routing: within a craft on /shop, otherwise the full-site search (pieces, crafts, artisans). */
export function searchHref(q: string, category: string) {
  const t = q.trim();
  if (category) return `/shop?${new URLSearchParams({ category, ...(t ? { q: t } : {}) })}`;
  return t ? `/search?${new URLSearchParams({ q: t })}` : "/search";
}
