/**
 * Texture surfaces for the 3D heritage objects. Where an object's form is real
 * geometry (pottery, stone, wood, salt) these are material textures; where the
 * craft is flat (rugs, calligraphy, paintings, prints, cloth, tiles) they are the
 * same seeded design as the product illustration, full-bleed.
 */
import { NASTALIQ_PHRASES, type NastaliqPhraseKey } from "./nastaliq-subsets";
import { ajrak, calligraphy, print, rug, tile, truckart, type ArtKind } from "./generators";
import { el, f, grainFilter, linear, pick, polygon, radial, rng, starPoints, svgDoc } from "./svg";

const CALLIGRAPHY_KEYS: NastaliqPhraseKey[] = ["iqbal", "noor", "mohabbat", "sabr", "hunar", "umeed", "khushamdeed", "wahbayaan"];

export function calligraphyPhraseFor(seed: number): NastaliqPhraseKey {
  return CALLIGRAPHY_KEYS[seed % CALLIGRAPHY_KEYS.length];
}

export function isLongPhrase(key: NastaliqPhraseKey) {
  return key === "iqbal" || key === "khushamdeed" || key === "wahbayaan";
}

function floral(x: number, y: number, s: number, blue: string, turq: string, petals = 8) {
  const out: string[] = [];
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    const px = x + Math.cos(a) * s * 0.55;
    const py = y + Math.sin(a) * s * 0.55;
    out.push(el("ellipse", { cx: f(px), cy: f(py), rx: f(s * 0.42), ry: f(s * 0.2), transform: `rotate(${f((a * 180) / Math.PI)} ${f(px)} ${f(py)})`, fill: i % 2 ? turq : blue }));
  }
  out.push(el("circle", { cx: f(x), cy: f(y), r: f(s * 0.24), fill: "#fdfaf2", stroke: blue, "stroke-width": 3 }));
  return out.join("");
}

/** Seamless horizontal wrap for a lathe-turned vase or bowl (u = around, v = top→bottom). */
export function potteryWrap(seed: number) {
  const r = rng(seed);
  const blue = pick(r, ["#2f5ea8", "#1f4f9a", "#2d5fb0"]);
  const turq = pick(r, ["#2a9da8", "#39a8b3", "#2e93a0"]);
  const W = 2048;
  const H = 1024;
  const body: string[] = [el("rect", { width: W, height: H, fill: "#f8f5ee" })];
  for (const [y, h] of [
    [0.05, 0.03],
    [0.2, 0.018],
    [0.86, 0.02],
    [0.93, 0.035],
  ] as const)
    body.push(el("rect", { y: H * y, width: W, height: H * h, fill: blue }));
  const rows = [
    { y: 0.13, n: 16, s: 0.045 },
    { y: 0.38, n: 10, s: 0.09 },
    { y: 0.6, n: 12, s: 0.07 },
    { y: 0.78, n: 16, s: 0.045 },
  ];
  rows.forEach((row, i) => {
    for (let k = 0; k < row.n; k++) {
      const x = ((k + (i % 2) * 0.5) / row.n) * W;
      body.push(floral(x, H * row.y, H * row.s, blue, turq));
      if (x < H * row.s) body.push(floral(x + W, H * row.y, H * row.s, blue, turq)); // wrap seam
    }
  });
  // Vines linking the big flowers
  body.push(el("path", { d: `M0 ${H * 0.49} ${Array.from({ length: 20 }, (_, i) => `Q ${f(((i + 0.5) / 20) * W)} ${f(H * (i % 2 ? 0.45 : 0.53))} ${f(((i + 1) / 20) * W)} ${f(H * 0.49)}`).join(" ")}`, fill: "none", stroke: turq, "stroke-width": 6 }));
  return svgDoc(W, H, body.join(""), grainFilter("g", 0.06), "Blue pottery glaze wrap");
}

/** Top-down charger plate texture. */
export function potteryPlate(seed: number) {
  const r = rng(seed);
  const blue = pick(r, ["#2f5ea8", "#1f4f9a", "#2d5fb0"]);
  const turq = pick(r, ["#2a9da8", "#39a8b3", "#2e93a0"]);
  const S = 1024;
  const c = S / 2;
  const R = S / 2;
  const body: string[] = [el("rect", { width: S, height: S, fill: "#f8f5ee" })];
  body.push(el("circle", { cx: c, cy: c, r: R * 0.97, fill: "none", stroke: blue, "stroke-width": R * 0.05 }));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    body.push(floral(c + Math.cos(a) * R * 0.8, c + Math.sin(a) * R * 0.8, R * 0.085, blue, turq, 6));
  }
  body.push(el("circle", { cx: c, cy: c, r: R * 0.66, fill: "none", stroke: turq, "stroke-width": R * 0.02 }));
  body.push(el("polygon", { points: starPoints(c, c, R * 0.55, R * 0.3, 8), fill: blue }));
  body.push(el("polygon", { points: starPoints(c, c, R * 0.42, R * 0.22, 8, Math.PI / 8), fill: turq }));
  body.push(floral(c, c, R * 0.22, blue, turq, 10));
  return svgDoc(S, S, body.join(""), grainFilter("g", 0.05), "Blue pottery plate glaze");
}

/** Chisel-finished schist. */
export function stoneTexture(seed: number) {
  const r = rng(seed);
  const tone = pick(r, [
    ["#858b82", "#5a6059"],
    ["#8f8677", "#5f574b"],
    ["#77827f", "#48524f"],
  ]);
  const S = 1024;
  return svgDoc(
    S,
    S,
    el("rect", { width: S, height: S, fill: "url(#s)" }) + el("rect", { width: S, height: S, fill: "url(#s)", filter: "url(#chisel)", opacity: 0.6 }),
    linear("s", [
      [0, tone[0]],
      [1, tone[1]],
    ]) +
      el("filter", { id: "chisel", x: 0, y: 0, width: "100%", height: "100%" }, [
        el("feTurbulence", { type: "fractalNoise", baseFrequency: 0.6, numOctaves: 4, seed: seed % 50, result: "n" }),
        el("feDiffuseLighting", { in: "n", "lighting-color": "#ddd", surfaceScale: 2, result: "l" }, el("feDistantLight", { azimuth: 45, elevation: 50 })),
        el("feComposite", { in: "l", in2: "SourceGraphic", operator: "arithmetic", k1: 1, k2: 0, k3: 0, k4: 0 }),
      ]),
    "Schist texture",
  );
}

/** Seasoned sheesham grain. */
export function woodTexture(seed: number) {
  const r = rng(seed);
  const tone = pick(r, [
    ["#8a5a34", "#5a361b"],
    ["#6e4526", "#40250f"],
    ["#9c6a3c", "#63401f"],
  ]);
  const S = 1024;
  return svgDoc(
    S,
    S,
    el("rect", { width: S, height: S, fill: "url(#w)", filter: "url(#grain)" }),
    linear(
      "w",
      [
        [0, tone[0]],
        [1, tone[1]],
      ],
      1,
      1,
    ) +
      el("filter", { id: "grain", x: 0, y: 0, width: "100%", height: "100%" }, [
        el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.004 0.12", numOctaves: 4, seed: seed % 40, result: "n" }),
        el("feColorMatrix", { in: "n", type: "matrix", values: "0 0 0 0 0.18  0 0 0 0 0.09  0 0 0 0 0.03  0 0 0 0.75 0", result: "g" }),
        el("feComposite", { in: "g", in2: "SourceGraphic", operator: "atop" }),
      ]),
    "Wood grain",
  );
}

/** Warm salt-crystal gradient (the lamp itself is geometry + shader). */
export function saltTexture(seed: number) {
  const S = 512;
  const r = rng(seed);
  const facets: string[] = [];
  for (let i = 0; i < 60; i++) {
    const x = r() * S;
    const y = r() * S;
    const s = 20 + r() * 60;
    facets.push(el("polygon", { points: polygon([[x, y], [x + s, y + s * 0.3], [x + s * 0.4, y + s]]), fill: "#fff3e0", opacity: f(0.05 + r() * 0.12) }));
  }
  return svgDoc(S, S, el("rect", { width: S, height: S, fill: "url(#g)" }) + facets.join(""), radial("g", [[0, "#ffd9b8"], [0.6, "#f19b72"], [1, "#d8704e"]]), "Salt texture");
}

export type SurfaceInfo = { aspect: number };

export function renderSurface(kind: ArtKind, seed: number): string {
  switch (kind) {
    case "rug":
      return rug(seed, { w: 1000, h: 1500 }, { surface: true });
    case "calligraphy": {
      const key = calligraphyPhraseFor(seed);
      return calligraphy(seed, isLongPhrase(key) ? { w: 1400, h: 860 } : { w: 1000, h: 1220 }, key, { surface: true });
    }
    case "truckart":
      return truckart(seed, { w: 1000, h: 1250 }, { surface: true });
    case "print":
      return print(seed, { w: 1000, h: 1380 }, { surface: true });
    case "ajrak":
      return ajrak(seed, { w: 1000, h: 1300 }, { surface: true });
    case "tile":
      return tile(seed, { w: 1024, h: 1024 });
    case "pottery":
      return seed % 3 === 1 ? potteryPlate(seed) : potteryWrap(seed);
    case "stone":
      return stoneTexture(seed);
    case "wood":
      return woodTexture(seed);
    case "salt":
      return saltTexture(seed);
    default:
      return tile(seed, { w: 512, h: 512 });
  }
}

export const PHRASES = NASTALIQ_PHRASES;
