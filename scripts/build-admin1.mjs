// Builds public/geo/admin1.json — states/provinces for the visitor map's zoomed-in view.
//
//   node scripts/build-admin1.mjs [path/to/ne_10m_admin_1_states_provinces.geojson]
//
// Source: Natural Earth 1:10m "Admin 1 – States, Provinces" (public domain), from
// github.com/nvkelso/natural-earth-vector. No npm package ships Natural Earth admin-1
// for Pakistan (apexmaps-geo covers 15 countries, not PK/AE/SA), so we keep only the
// countries Wahbayaan's visitors come from, simplify them hard and commit the result
// (~0.5 MB). The map fetches it lazily from /geo/admin1.json once you zoom in (k ≥ 4).
// Re-run this when the country list changes. Without an argument the script downloads
// the 40 MB source into .cache/ (gitignored) first.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import { feature, merge } from "topojson-client";

const SRC_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
/** Where visitors come from: Pakistan and its diaspora markets, plus the larger traffic sources. */
export const ADMIN1_COUNTRIES = [
  "PK", "IN", "BD", "AE", "SA", "QA", "KW", "OM", "BH", "TR",
  "US", "CA", "MX", "BR", "GB", "IE", "FR", "DE", "NL", "BE", "ES", "IT", "NO", "SE",
  "AU", "NZ", "CN", "JP", "MY", "ID", "ZA", "NG",
];
/** Countries whose admin-1 units are tiny (UK boroughs) are dissolved into regions. */
const DISSOLVE_BY_REGION = new Set(["GB", "IE", "FR", "IT", "BE"]);

let src = process.argv[2];
if (!src) {
  src = resolve(".cache/ne_10m_admin_1_states_provinces.geojson");
  if (!existsSync(src)) {
    mkdirSync(dirname(src), { recursive: true });
    console.log("Downloading", SRC_URL);
    const res = await fetch(SRC_URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    writeFileSync(src, Buffer.from(await res.arrayBuffer()));
  }
}

const geo = JSON.parse(readFileSync(src, "utf8"));
const wanted = new Set(ADMIN1_COUNTRIES);
const features = geo.features
  .filter((f) => wanted.has(f.properties.iso_a2) && f.geometry)
  .map((f) => ({
    type: "Feature",
    properties: {
      n: f.properties.name_en || f.properties.name,
      c: f.properties.iso_a2,
      r: DISSOLVE_BY_REGION.has(f.properties.iso_a2) ? f.properties.region || f.properties.geonunit || f.properties.name : null,
    },
    geometry: f.geometry,
  }));

let topo = topology({ a: { type: "FeatureCollection", features } }, 1e6);
topo = presimplify(topo);
topo = simplify(topo, quantile(topo, 0.12));

// Dissolve tiny units into regions (merge keeps shared arcs, so borders stay consistent).
const geoms = topo.objects.a.geometries;
const out = [];
const groups = new Map();
for (const g of geoms) {
  if (!g.properties.r) {
    out.push({ type: "Feature", properties: { n: g.properties.n, c: g.properties.c }, geometry: feature(topo, g).geometry });
    continue;
  }
  const key = `${g.properties.c}|${g.properties.r}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(g);
}
for (const [key, list] of groups) {
  const [c, n] = key.split("|");
  out.push({ type: "Feature", properties: { n, c }, geometry: merge(topo, list) });
}

const final = topology({ admin1: { type: "FeatureCollection", features: out } }, 4e4);

const dest = resolve("public/geo/admin1.json");
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(final));
console.log(`Wrote ${dest}: ${out.length} units from ${ADMIN1_COUNTRIES.length} countries, ${(JSON.stringify(final).length / 1024).toFixed(0)} KB`);
