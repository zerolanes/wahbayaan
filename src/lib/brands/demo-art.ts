/**
 * Procedural garment illustrations for the FICTIONAL demo brands (and the
 * recorded fixtures). They stand in for brand photography in demo mode only and
 * are stored as `kind: "illustration"`. Pure, deterministic per seed.
 */
export const BRAND_ART_KINDS = ["kurta", "suit", "waistcoat", "logo"] as const;
export type BrandArtKind = (typeof BRAND_ART_KINDS)[number];

const PALETTES = [
  ["#f4ecdc", "#b8893b", "#25305a"],
  ["#e8d3c6", "#b5532e", "#3a2a1e"],
  ["#dfe9e4", "#1f7a5a", "#15192e"],
  ["#efe1ea", "#8f1f24", "#3a2a1e"],
  ["#e3e6f2", "#34498a", "#b8893b"],
  ["#f1e2b6", "#2a9da8", "#5a3a22"],
];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10_000) / 10_000;
  };
}

function pattern(id: string, seed: number, fg: string, accent: string) {
  const r = rng(seed * 7 + 3);
  const kind = Math.floor(r() * 3);
  const size = 22 + Math.floor(r() * 18);
  if (kind === 0)
    return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 6}" fill="${fg}" opacity=".55"/><circle cx="0" cy="0" r="${size / 10}" fill="${accent}" opacity=".6"/></pattern>`;
  if (kind === 1)
    return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="${size / 3}" height="${size}" fill="${fg}" opacity=".35"/><rect x="${size / 2}" width="2" height="${size}" fill="${accent}" opacity=".5"/></pattern>`;
  const p = size / 2;
  return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><path d="M${p} 3 L${size - 3} ${p} L${p} ${size - 3} L3 ${p} Z" fill="none" stroke="${fg}" stroke-width="2" opacity=".5"/><circle cx="${p}" cy="${p}" r="2.5" fill="${accent}"/></pattern>`;
}

function silhouette(kind: Exclude<BrandArtKind, "logo">) {
  if (kind === "waistcoat") return "M420 300 L520 260 L600 420 L680 260 L780 300 L800 1080 L600 1120 L400 1080 Z";
  if (kind === "suit")
    // Long shirt with a dupatta drape over one shoulder.
    return "M470 250 L560 230 Q600 290 640 230 L730 250 L900 420 L840 520 L770 450 L790 1250 L410 1250 L430 450 L360 520 L300 420 Z";
  return "M480 250 L560 230 Q600 300 640 230 L720 250 L880 430 L820 520 L760 460 L770 1180 L430 1180 L440 460 L380 520 L320 430 Z";
}

export function renderBrandArt(kind: BrandArtKind, seed: number, label?: string): string {
  const [bg, fabric, ink] = PALETTES[seed % PALETTES.length];
  if (kind === "logo") {
    const text = (label ?? "WB").slice(0, 3).toUpperCase();
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="Illustration: brand monogram"><rect width="400" height="400" fill="${bg}"/><circle cx="200" cy="200" r="150" fill="none" stroke="${ink}" stroke-width="6"/><text x="200" y="235" text-anchor="middle" font-family="Georgia, serif" font-size="110" fill="${ink}" letter-spacing="6">${text.replace(/[<&>]/g, "")}</text></svg>`;
  }
  const accent = PALETTES[(seed + 2) % PALETTES.length][1];
  const path = silhouette(kind);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1500" role="img" aria-label="Illustration: ${kind}"><defs>${pattern("p", seed, ink, accent)}<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs><rect width="1200" height="1500" fill="url(#g)"/><ellipse cx="600" cy="1320" rx="330" ry="40" fill="#000" opacity=".06"/><g transform="translate(0,40)"><path d="${path}" fill="${fabric}"/><path d="${path}" fill="url(#p)"/><path d="${path}" fill="none" stroke="${ink}" stroke-opacity=".25" stroke-width="4"/>${
    kind === "suit" ? `<path d="M640 235 Q820 600 760 1180 L700 1180 Q760 640 600 300 Z" fill="${accent}" opacity=".55"/>` : `<path d="M600 300 L600 620" stroke="${ink}" stroke-opacity=".35" stroke-width="5"/>`
  }</g></svg>`;
}
