/**
 * Procedural heritage artwork.
 *
 * These are brand illustrations, not photographs: they fill image slots for
 * demo content and category art until real photography is uploaded. Anything
 * using them is flagged `kind: "illustration"` and listed by the admin
 * launch-readiness check as "needs real photography".
 */
import { NASTALIQ_PHRASES, type NastaliqPhraseKey } from "./nastaliq-subsets";
import { el, f, grainFilter, int, linear, pick, polygon, radial, range, rng, shadowFilter, starPoints, svgDoc, type Rng } from "./svg";

export const PALETTE = {
  ink: "#15192e",
  indigo: "#25305a",
  indigoMid: "#34498a",
  multani: "#2f5ea8",
  turquoise: "#2a9da8",
  turquoiseLight: "#7cc9cf",
  terracotta: "#b5532e",
  terracottaLight: "#dc8a5f",
  madder: "#8f1f24",
  rust: "#a8452a",
  gold: "#b8893b",
  goldLight: "#e2c27a",
  goldPale: "#f1e2b6",
  parchment: "#f5eee1",
  sand: "#e6d7bc",
  umber: "#3a2a1e",
  walnut: "#5a3a22",
  teak: "#8a5a34",
  ivory: "#f4ecdc",
  green: "#1f7a5a",
  rose: "#e59a86",
  stone: "#8c8f86",
  schist: "#5f665f",
};

export type ArtKind =
  "rug" | "calligraphy" | "pottery" | "truckart" | "stone" | "salt" | "wood" | "print" | "ajrak" | "tile" | "furniture" | "snooker" | "avatar" | "banner";

export const ART_KINDS: ArtKind[] = [
  "rug",
  "calligraphy",
  "pottery",
  "truckart",
  "stone",
  "salt",
  "wood",
  "print",
  "ajrak",
  "tile",
  "furniture",
  "snooker",
  "avatar",
  "banner",
];

type Canvas = { w: number; h: number };
export type SurfaceOpts = { surface?: boolean };

/** In surface mode the wall, floor and vignette are dropped so the design fills the texture. */
function layers(bg: ReturnType<typeof wall>, opts: SurfaceOpts) {
  return opts.surface ? { ...bg, back: "", floor: "", front: "" } : bg;
}

// ── Backdrops ───────────────────────────────────────────────────────────────

function wall(c: Canvas, r: Rng, tone: "light" | "dark" = "light") {
  const light = [
    ["#f3ebdd", "#e4d5bb"],
    ["#efe6d6", "#dccbb0"],
    ["#f2e8e0", "#e0cbbd"],
    ["#e9e4d6", "#d2c9b2"],
  ];
  const dark = [
    ["#2a2330", "#15121c"],
    ["#1d2338", "#0e1122"],
    ["#2c2119", "#140e0a"],
  ];
  const [a, b] = pick(r, tone === "light" ? light : dark);
  const floorY = c.h * 0.78;
  return {
    defs:
      linear("wall", [
        [0, a],
        [1, b],
      ]) +
      linear("floor", [
        [0, tone === "light" ? "#cdb999" : "#0b0a0f"],
        [1, tone === "light" ? "#b39c78" : "#050407"],
      ]) +
      radial(
        "vignette",
        [
          [0.55, "#000", 0],
          [1, "#000", tone === "light" ? 0.16 : 0.5],
        ],
        0.5,
        0.45,
        0.75,
      ) +
      grainFilter("grain", tone === "light" ? 0.12 : 0.2),
    back: el("rect", { width: c.w, height: c.h, fill: "url(#wall)", filter: "url(#grain)" }),
    floor: el("rect", { y: floorY, width: c.w, height: c.h - floorY, fill: "url(#floor)", opacity: 0.9 }),
    front: el("rect", { width: c.w, height: c.h, fill: "url(#vignette)" }),
    floorY,
  };
}

// ── Rug (hand-knotted, Bukhara-style guls) ──────────────────────────────────

export function rug(seed: number, c: Canvas = { w: 1200, h: 1500 }, opts: SurfaceOpts = {}) {
  const r = rng(seed);
  const schemes = [
    { field: "#8f1f24", ground2: "#6d1419", gul: "#f0e2c4", accent: "#1c2445", line: "#2a1a14" },
    { field: "#24305c", ground2: "#1a2346", gul: "#e9d8b0", accent: "#9b2c2a", line: "#10142a" },
    { field: "#a8452a", ground2: "#86331f", gul: "#f3e6cd", accent: "#1f3a5c", line: "#3a1a10" },
    { field: "#efe3c8", ground2: "#e2d2b0", gul: "#8f1f24", accent: "#24305c", line: "#5a3a22" },
    { field: "#2d4a3e", ground2: "#223a31", gul: "#e8d6ad", accent: "#a8452a", line: "#122019" },
  ];
  const s = pick(r, schemes);
  const bg = wall(c, r);
  const portrait = c.h >= c.w;
  const rw = opts.surface ? c.w : portrait ? c.w * 0.64 : c.w * 0.44;
  const rh = opts.surface ? c.h : portrait ? rw * 1.45 : c.h * 0.8;
  const x0 = opts.surface ? 0 : (c.w - rw) / 2;
  const y0 = opts.surface ? 0 : (c.h - rh) / 2 - (portrait ? c.h * 0.02 : 0);
  const b = rw * 0.1; // border width

  const defs = [
    bg.defs,
    shadowFilter("shadow", 24, 26, 0.4),
    grainFilter("wool", 0.35, 1.4),
    el("pattern", { id: "borderMotif", width: b * 0.9, height: b * 0.9, patternUnits: "userSpaceOnUse" }, [
      el("rect", { width: b * 0.9, height: b * 0.9, fill: s.accent }),
      el("polygon", { points: starPoints(b * 0.45, b * 0.45, b * 0.36, b * 0.16, 8), fill: s.gul }),
      el("circle", { cx: b * 0.45, cy: b * 0.45, r: b * 0.08, fill: s.field }),
    ]),
    el("pattern", { id: "guard", width: b * 0.3, height: b * 0.3, patternUnits: "userSpaceOnUse" }, [
      el("rect", { width: b * 0.3, height: b * 0.3, fill: s.gul }),
      el("polygon", {
        points: polygon([
          [0, b * 0.15],
          [b * 0.15, 0],
          [b * 0.3, b * 0.15],
          [b * 0.15, b * 0.3],
        ]),
        fill: s.field,
      }),
    ]),
  ].join("");

  // Field guls
  const cols = portrait ? int(r, 2, 3) : 3;
  const fx = x0 + b * 1.25;
  const fy = y0 + b * 1.25;
  const fw = rw - b * 2.5;
  const fh = rh - b * 2.5;
  const rows = Math.max(3, Math.round((fh / fw) * cols));
  const cw = fw / cols;
  const ch = fh / rows;
  const guls: string[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cx = fx + cw * (i + 0.5);
      const cy = fy + ch * (j + 0.5);
      const gw = cw * 0.4;
      const gh = ch * 0.36;
      const oct = polygon([
        [cx - gw * 0.5, cy - gh],
        [cx + gw * 0.5, cy - gh],
        [cx + gw, cy - gh * 0.45],
        [cx + gw, cy + gh * 0.45],
        [cx + gw * 0.5, cy + gh],
        [cx - gw * 0.5, cy + gh],
        [cx - gw, cy + gh * 0.45],
        [cx - gw, cy - gh * 0.45],
      ]);
      guls.push(el("polygon", { points: oct, fill: s.gul, stroke: s.line, "stroke-width": 3 }));
      // Quartered interior
      guls.push(el("path", { d: `M${f(cx - gw)} ${f(cy)}H${f(cx + gw)}M${f(cx)} ${f(cy - gh)}V${f(cy + gh)}`, stroke: s.line, "stroke-width": 3 }));
      const q = [
        [-1, -1],
        [1, 1],
      ];
      for (const [sx, sy] of q) {
        guls.push(
          el("rect", {
            x: f(sx < 0 ? cx - gw * 0.72 : cx + gw * 0.12),
            y: f(sy < 0 ? cy - gh * 0.72 : cy + gh * 0.12),
            width: f(gw * 0.6),
            height: f(gh * 0.6),
            fill: s.accent,
            opacity: 0.9,
          }),
        );
      }
      guls.push(
        el("polygon", { points: starPoints(cx, cy, Math.min(gw, gh) * 0.42, Math.min(gw, gh) * 0.18, 8), fill: s.field, stroke: s.gul, "stroke-width": 2 }),
      );
      // Minor gul between rows
      if (j < rows - 1) {
        const my = cy + ch / 2;
        const m = Math.min(cw, ch) * 0.12;
        guls.push(
          el("polygon", {
            points: polygon([
              [cx, my - m],
              [cx + m * 1.4, my],
              [cx, my + m],
              [cx - m * 1.4, my],
            ]),
            fill: s.accent,
            stroke: s.gul,
            "stroke-width": 2,
          }),
        );
      }
    }
    // Vertical lines linking guls (the "tree" of a Bukhara field)
    guls.push(el("line", { x1: f(fx + cw * (i + 0.5)), y1: fy, x2: f(fx + cw * (i + 0.5)), y2: fy + fh, stroke: s.line, "stroke-width": 2, opacity: 0.5 }));
  }

  // Fringe
  const fringe: string[] = [];
  for (let x = x0 + 6; x < x0 + rw - 4; x += 7) {
    const len = range(r, 22, 34);
    fringe.push(
      el("line", { x1: f(x), y1: f(y0), x2: f(x + range(r, -3, 3)), y2: f(y0 - len), stroke: "#efe4cc", "stroke-width": 3, "stroke-linecap": "round" }),
    );
    fringe.push(
      el("line", {
        x1: f(x),
        y1: f(y0 + rh),
        x2: f(x + range(r, -3, 3)),
        y2: f(y0 + rh + len),
        stroke: "#efe4cc",
        "stroke-width": 3,
        "stroke-linecap": "round",
      }),
    );
  }

  const rugBody = el("g", { filter: "url(#shadow)" }, [
    el("rect", { x: x0, y: y0, width: rw, height: rh, fill: "url(#guard)" }),
    el("rect", { x: x0 + b * 0.3, y: y0 + b * 0.3, width: rw - b * 0.6, height: rh - b * 0.6, fill: "url(#borderMotif)" }),
    el("rect", { x: x0 + b * 1.1, y: y0 + b * 1.1, width: rw - b * 2.2, height: rh - b * 2.2, fill: "url(#guard)" }),
    el("rect", { x: fx, y: fy, width: fw, height: fh, fill: s.field }),
    el("rect", { x: fx, y: fy, width: fw, height: fh, fill: s.ground2, opacity: 0.25 }),
    ...guls,
  ]);

  return svgDoc(
    c.w,
    c.h,
    opts.surface
      ? el("g", { filter: "url(#wool)" }, rugBody)
      : [bg.back, bg.floor, fringe.join(""), el("g", { filter: "url(#wool)" }, rugBody), bg.front].join(""),
    defs,
    "Illustration: hand-knotted rug",
  );
}

// ── Calligraphy panel ───────────────────────────────────────────────────────

const CALLIGRAPHY_KEYS: NastaliqPhraseKey[] = ["iqbal", "noor", "mohabbat", "sabr", "hunar", "umeed", "khushamdeed", "wahbayaan"];

const PHRASE_SIZE: Record<NastaliqPhraseKey, number> = {
  iqbal: 0.075,
  wahbayaan: 0.19,
  noor: 0.36,
  mohabbat: 0.26,
  sabr: 0.3,
  hunar: 0.3,
  umeed: 0.28,
  khushamdeed: 0.16,
};

export function calligraphy(seed: number, c: Canvas = { w: 1200, h: 1500 }, phrase?: NastaliqPhraseKey, opts: SurfaceOpts = {}) {
  const r = rng(seed);
  const key = phrase ?? CALLIGRAPHY_KEYS[seed % CALLIGRAPHY_KEYS.length];
  const p = NASTALIQ_PHRASES[key];
  const schemes = [
    { panel: "#16203f", panel2: "#0f1630", ink: "url(#goldInk)", mat: "#2f5ea8" },
    { panel: "#efe4c9", panel2: "#e3d3b0", ink: "#1b1b2b", mat: "#8f1f24" },
    { panel: "#1d1a1a", panel2: "#0e0c0c", ink: "url(#goldInk)", mat: "#1f7a5a" },
    { panel: "#6d1419", panel2: "#4f0d11", ink: "url(#goldInk)", mat: "#b8893b" },
  ];
  const s = pick(r, schemes);
  const bg = layers(wall(c, r), opts);
  const portrait = c.h >= c.w;
  const long = key === "iqbal" || key === "khushamdeed" || key === "wahbayaan";
  const fw = opts.surface ? c.w : portrait ? c.w * 0.72 : c.w * 0.5;
  const fh = opts.surface ? c.h : portrait ? (long ? fw * 0.62 : fw * 1.22) : c.h * 0.7;
  const x0 = opts.surface ? 0 : (c.w - fw) / 2;
  const y0 = opts.surface ? 0 : (c.h - fh) / 2 - c.h * 0.03;
  const frame = opts.surface ? 0 : fw * 0.055;
  const mat = fw * 0.07;

  const defs = [
    bg.defs,
    `<style>@font-face{font-family:"WB Nastaliq";src:url(data:font/woff2;base64,${p.font}) format("woff2");}</style>`,
    shadowFilter("shadow", 26, 24, 0.42),
    linear(
      "goldFrame",
      [
        [0, "#7a5a22"],
        [0.25, "#e2c27a"],
        [0.5, "#a57a31"],
        [0.75, "#f1dc9c"],
        [1, "#6d4f1c"],
      ],
      1,
      1,
    ),
    linear(
      "goldInk",
      [
        [0, "#f4dd9a"],
        [0.5, "#c89b45"],
        [1, "#f0d589"],
      ],
      1,
      1,
    ),
    linear("panelGrad", [
      [0, s.panel],
      [1, s.panel2],
    ]),
    // Ebru-style marbled mat
    el("filter", { id: "marble", x: 0, y: 0, width: "100%", height: "100%" }, [
      el("feTurbulence", { type: "turbulence", baseFrequency: "0.012 0.03", numOctaves: 3, seed: seed % 97, result: "t" }),
      el("feColorMatrix", { in: "t", type: "matrix", values: "0 0 0 0 0.95  0 0 0 0 0.92  0 0 0 0 0.85  0 0 0 1.4 -0.2", result: "veins" }),
      el("feComposite", { in: "veins", in2: "SourceGraphic", operator: "atop" }),
    ]),
    grainFilter("paper", 0.18, 1.1),
  ].join("");

  const cx = c.w / 2;
  const ix = x0 + frame + mat;
  const iy = y0 + frame + mat;
  const iw = fw - 2 * (frame + mat);
  const ih = fh - 2 * (frame + mat);
  const size = Math.round(iw * PHRASE_SIZE[key] * (portrait ? 1 : 0.95));

  // Illuminated corners (tezhip)
  const corner = (x: number, y: number, sx: number, sy: number) =>
    el("g", { transform: `translate(${f(x)} ${f(y)}) scale(${sx} ${sy})` }, [
      el("path", {
        d: `M0 0 Q ${f(iw * 0.16)} 0 ${f(iw * 0.16)} ${f(iw * 0.05)} Q ${f(iw * 0.05)} ${f(iw * 0.05)} ${f(iw * 0.05)} ${f(iw * 0.16)} Q 0 ${f(iw * 0.16)} 0 0Z`,
        fill: "url(#goldInk)",
        opacity: 0.85,
      }),
      el("circle", { cx: f(iw * 0.045), cy: f(iw * 0.045), r: f(iw * 0.018), fill: s.mat }),
    ]);

  const body = [
    bg.back,
    el("g", { filter: "url(#shadow)" }, [
      el("rect", { x: x0, y: y0, width: fw, height: fh, fill: "url(#goldFrame)", rx: 4 }),
      el("rect", { x: x0 + frame, y: y0 + frame, width: fw - 2 * frame, height: fh - 2 * frame, fill: s.mat, filter: "url(#marble)" }),
      el("rect", { x: ix - 4, y: iy - 4, width: iw + 8, height: ih + 8, fill: "url(#goldInk)" }),
      el("rect", { x: ix, y: iy, width: iw, height: ih, fill: "url(#panelGrad)", filter: "url(#paper)" }),
      el("rect", { x: ix + iw * 0.04, y: iy + iw * 0.04, width: iw * 0.92, height: ih - iw * 0.08, fill: "none", stroke: "url(#goldInk)", "stroke-width": 2 }),
      corner(ix + iw * 0.04, iy + iw * 0.04, 1, 1),
      corner(ix + iw * 0.96, iy + iw * 0.04, -1, 1),
      corner(ix + iw * 0.04, iy + ih - iw * 0.04, 1, -1),
      corner(ix + iw * 0.96, iy + ih - iw * 0.04, -1, -1),
      el(
        "text",
        {
          x: f(cx),
          y: f(iy + ih * 0.5 + size * 0.28),
          "text-anchor": "middle",
          direction: "rtl",
          "font-family": "WB Nastaliq",
          "font-size": size,
          "font-weight": 700,
          fill: s.ink,
        },
        p.text,
      ),
    ]),
    bg.front,
  ].join("");
  return svgDoc(c.w, c.h, body, defs, `Illustration: calligraphy panel — ${p.meaning}`);
}

// ── Multani blue pottery ────────────────────────────────────────────────────

export function pottery(seed: number, c: Canvas = { w: 1200, h: 1500 }) {
  const r = rng(seed);
  const bg = wall(c, r);
  const variant = seed % 3; // 0 vase, 1 plate, 2 bowl
  const blue = pick(r, [PALETTE.multani, "#1f4f9a", "#2d5fb0"]);
  const turq = pick(r, [PALETTE.turquoise, "#39a8b3", "#2e93a0"]);
  const cx = c.w / 2;
  const scale = Math.min(c.w, c.h * 0.8);

  const floral = (x: number, y: number, s: number, petals = 8) => {
    const out: string[] = [];
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      out.push(
        el("ellipse", {
          cx: f(x + Math.cos(a) * s * 0.55),
          cy: f(y + Math.sin(a) * s * 0.55),
          rx: f(s * 0.42),
          ry: f(s * 0.2),
          transform: `rotate(${f((a * 180) / Math.PI)} ${f(x + Math.cos(a) * s * 0.55)} ${f(y + Math.sin(a) * s * 0.55)})`,
          fill: i % 2 ? turq : blue,
        }),
      );
    }
    out.push(el("circle", { cx: f(x), cy: f(y), r: f(s * 0.24), fill: "#fdfaf2", stroke: blue, "stroke-width": 3 }));
    return out.join("");
  };

  const defs = [
    bg.defs,
    shadowFilter("shadow", 26, 22, 0.35),
    linear(
      "glaze",
      [
        [0, "#cfd3d6"],
        [0.18, "#ffffff"],
        [0.55, "#f7f4ec"],
        [1, "#b7b9b8"],
      ],
      1,
      0,
    ),
    linear(
      "shade",
      [
        [0, "#000", 0.28],
        [0.2, "#000", 0],
        [0.7, "#000", 0],
        [1, "#000", 0.35],
      ],
      1,
      0,
    ),
    radial(
      "plateShade",
      [
        [0.7, "#000", 0],
        [1, "#000", 0.25],
      ],
      0.45,
      0.4,
      0.6,
    ),
  ].join("");

  let obj = "";
  if (variant === 1) {
    const R = scale * 0.36;
    const cy = c.h * 0.46;
    const rings: string[] = [];
    rings.push(el("circle", { cx, cy, r: R, fill: "url(#glaze)" }));
    rings.push(el("circle", { cx, cy, r: R * 0.97, fill: "none", stroke: blue, "stroke-width": R * 0.05 }));
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      rings.push(floral(cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8, R * 0.09, 6));
    }
    rings.push(el("circle", { cx, cy, r: R * 0.66, fill: "none", stroke: turq, "stroke-width": R * 0.02 }));
    rings.push(el("polygon", { points: starPoints(cx, cy, R * 0.55, R * 0.3, 8), fill: blue }));
    rings.push(el("polygon", { points: starPoints(cx, cy, R * 0.42, R * 0.22, 8, Math.PI / 8), fill: turq }));
    rings.push(floral(cx, cy, R * 0.22, 10));
    rings.push(el("circle", { cx, cy, r: R, fill: "url(#plateShade)" }));
    obj = el("g", { filter: "url(#shadow)" }, rings);
  } else {
    const H = variant === 0 ? scale * 0.72 : scale * 0.38;
    const W = variant === 0 ? scale * 0.46 : scale * 0.62;
    const top = variant === 0 ? c.h * 0.16 : c.h * 0.4;
    const base = top + H;
    const path =
      variant === 0
        ? `M${f(cx - W * 0.16)} ${f(top)} L${f(cx + W * 0.16)} ${f(top)} C${f(cx + W * 0.14)} ${f(top + H * 0.12)} ${f(cx + W * 0.12)} ${f(top + H * 0.2)} ${f(cx + W * 0.3)} ${f(top + H * 0.32)} C${f(cx + W * 0.62)} ${f(top + H * 0.52)} ${f(cx + W * 0.5)} ${f(top + H * 0.88)} ${f(cx + W * 0.2)} ${f(base)} L${f(cx - W * 0.2)} ${f(base)} C${f(cx - W * 0.5)} ${f(top + H * 0.88)} ${f(cx - W * 0.62)} ${f(top + H * 0.52)} ${f(cx - W * 0.3)} ${f(top + H * 0.32)} C${f(cx - W * 0.12)} ${f(top + H * 0.2)} ${f(cx - W * 0.14)} ${f(top + H * 0.12)} ${f(cx - W * 0.16)} ${f(top)}Z`
        : `M${f(cx - W / 2)} ${f(top)} L${f(cx + W / 2)} ${f(top)} C${f(cx + W * 0.48)} ${f(top + H * 0.7)} ${f(cx + W * 0.25)} ${f(base)} ${f(cx + W * 0.16)} ${f(base)} L${f(cx - W * 0.16)} ${f(base)} C${f(cx - W * 0.25)} ${f(base)} ${f(cx - W * 0.48)} ${f(top + H * 0.7)} ${f(cx - W / 2)} ${f(top)}Z`;
    const pattern: string[] = [];
    const bands = variant === 0 ? [0.06, 0.3, 0.92] : [0.08, 0.88];
    for (const bb of bands) pattern.push(el("rect", { x: cx - W, y: f(top + H * bb), width: W * 2, height: H * 0.035, fill: blue }));
    const rowsY = variant === 0 ? [0.44, 0.62, 0.78] : [0.35, 0.6];
    rowsY.forEach((ry, i) => {
      const count = variant === 0 ? 5 : 6;
      for (let k = 0; k < count; k++) {
        const x = cx - W * 0.6 + ((k + (i % 2) * 0.5) / (count - 1)) * W * 1.2;
        pattern.push(floral(x, top + H * ry, H * (variant === 0 ? 0.06 : 0.11), 8));
      }
    });
    obj = el("g", { filter: "url(#shadow)" }, [
      el("clipPath", { id: "vessel" }, el("path", { d: path })),
      el("path", { d: path, fill: "url(#glaze)" }),
      el("g", { "clip-path": "url(#vessel)" }, pattern.join("") + el("rect", { x: cx - W, y: top, width: W * 2, height: H, fill: "url(#shade)" })),
      variant === 2 ? el("ellipse", { cx, cy: top, rx: W / 2, ry: H * 0.08, fill: "#e9e6de", stroke: blue, "stroke-width": 4 }) : "",
      variant === 0 ? el("ellipse", { cx, cy: top, rx: W * 0.16, ry: H * 0.018, fill: "#2c2c35" }) : "",
    ]);
  }

  return svgDoc(c.w, c.h, [bg.back, bg.floor, obj, bg.front].join(""), defs, "Illustration: Multani blue pottery");
}

// ── Truck-art painting ──────────────────────────────────────────────────────

export function truckart(seed: number, c: Canvas = { w: 1200, h: 1500 }, opts: SurfaceOpts = {}) {
  const r = rng(seed);
  const bg = layers(wall(c, r), opts);
  const colors = ["#e63946", "#f4a261", "#2a9d8f", "#e9c46a", "#264653", "#ff006e", "#8338ec", "#06d6a0", "#ffbe0b", "#3a86ff"];
  const ground = pick(r, ["#12264f", "#1b1b3a", "#0f3d3e", "#5b0e2d"]);
  const portrait = c.h >= c.w;
  const pw = opts.surface ? c.w : portrait ? c.w * 0.7 : c.w * 0.56;
  const ph = opts.surface ? c.h : portrait ? pw * 1.25 : c.h * 0.74;
  const x0 = opts.surface ? 0 : (c.w - pw) / 2;
  const y0 = opts.surface ? 0 : (c.h - ph) / 2 - c.h * 0.03;
  const cx = x0 + pw / 2;
  const cy = y0 + ph / 2;

  const flower = (x: number, y: number, R: number, layers: number) => {
    const out: string[] = [];
    for (let l = 0; l < layers; l++) {
      const rr = R * (1 - l / (layers + 0.6));
      const petals = 8 + l * 2;
      const col = colors[(seed + l * 3) % colors.length];
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2 + l * 0.2;
        const px = x + Math.cos(a) * rr * 0.55;
        const py = y + Math.sin(a) * rr * 0.55;
        out.push(
          el("ellipse", {
            cx: f(px),
            cy: f(py),
            rx: f(rr * 0.42),
            ry: f(rr * 0.17),
            transform: `rotate(${f((a * 180) / Math.PI)} ${f(px)} ${f(py)})`,
            fill: col,
            stroke: "#fff",
            "stroke-width": 2,
          }),
        );
      }
    }
    out.push(el("circle", { cx: f(x), cy: f(y), r: f(R * 0.18), fill: "#ffbe0b", stroke: "#fff", "stroke-width": 3 }));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      out.push(el("circle", { cx: f(x + Math.cos(a) * R * 0.1), cy: f(y + Math.sin(a) * R * 0.1), r: f(R * 0.025), fill: "#fff" }));
    }
    return out.join("");
  };

  // Scalloped border ("jhalar") and mirror dots
  const border: string[] = [];
  const bw = pw * 0.07;
  const scallops = 14;
  for (let i = 0; i < scallops; i++) {
    const col = colors[(i + seed) % colors.length];
    const sx = x0 + (i / scallops) * pw;
    border.push(
      el("path", {
        d: `M${f(sx)} ${f(y0 + bw)} q ${f(pw / scallops / 2)} ${f(bw * 0.9)} ${f(pw / scallops)} 0 Z`,
        fill: col,
        stroke: "#fff",
        "stroke-width": 2,
      }),
    );
    border.push(
      el("path", {
        d: `M${f(sx)} ${f(y0 + ph - bw)} q ${f(pw / scallops / 2)} ${f(-bw * 0.9)} ${f(pw / scallops)} 0 Z`,
        fill: col,
        stroke: "#fff",
        "stroke-width": 2,
      }),
    );
  }
  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    border.push(el("circle", { cx: f(x0 + t * pw + 8), cy: f(y0 + bw * 0.45), r: 5, fill: "#fdf6e3" }));
    border.push(el("circle", { cx: f(x0 + t * pw + 8), cy: f(y0 + ph - bw * 0.45), r: 5, fill: "#fdf6e3" }));
  }
  const triangles: string[] = [];
  const tn = 12;
  for (let i = 0; i < tn; i++) {
    const ty = y0 + bw * 1.6 + (i / tn) * (ph - bw * 3.2);
    const col = colors[(i * 2 + seed) % colors.length];
    triangles.push(
      el("polygon", {
        points: polygon([
          [x0, ty],
          [x0 + bw, ty + (ph - bw * 3.2) / tn / 2],
          [x0, ty + (ph - bw * 3.2) / tn],
        ]),
        fill: col,
      }),
    );
    triangles.push(
      el("polygon", {
        points: polygon([
          [x0 + pw, ty],
          [x0 + pw - bw, ty + (ph - bw * 3.2) / tn / 2],
          [x0 + pw, ty + (ph - bw * 3.2) / tn],
        ]),
        fill: col,
      }),
    );
  }

  const defs = [bg.defs, shadowFilter("shadow", 26, 24, 0.4), grainFilter("paint", 0.14, 1.2)].join("");
  const small = pw * 0.12;
  const body = [
    bg.back,
    el("g", { filter: "url(#shadow)" }, [
      el("rect", { x: x0 - 14, y: y0 - 14, width: pw + 28, height: ph + 28, fill: PALETTE.walnut }),
      el("g", { filter: "url(#paint)" }, [
        el("rect", { x: x0, y: y0, width: pw, height: ph, fill: ground }),
        ...border,
        ...triangles,
        flower(cx, cy, pw * 0.3, 3),
        flower(x0 + pw * 0.24, y0 + ph * 0.22, small, 2),
        flower(x0 + pw * 0.76, y0 + ph * 0.22, small, 2),
        flower(x0 + pw * 0.24, y0 + ph * 0.78, small, 2),
        flower(x0 + pw * 0.76, y0 + ph * 0.78, small, 2),
      ]),
    ]),
    bg.front,
  ].join("");
  return svgDoc(c.w, c.h, body, defs, "Illustration: truck-art painting");
}

// ── Gandhara-style stone relief (Taxila) ────────────────────────────────────

export function stone(seed: number, c: Canvas = { w: 1200, h: 1500 }) {
  const r = rng(seed);
  const bg = wall(c, r, "dark");
  const tone = pick(r, [
    ["#7f857c", "#4f554f"],
    ["#8a8173", "#5a5246"],
    ["#6f7a78", "#3f4947"],
  ]);
  const portrait = c.h >= c.w;
  const pw = portrait ? c.w * 0.56 : c.w * 0.36;
  const ph = portrait ? pw * 1.45 : c.h * 0.74;
  const x0 = (c.w - pw) / 2;
  const y0 = (c.h - ph) / 2 - c.h * 0.04;
  const cx = c.w / 2;

  const defs = [
    bg.defs,
    linear("stoneFace", [
      [0, tone[0]],
      [1, tone[1]],
    ]),
    linear("niche", [
      [0, "#1c1f1c"],
      [1, "#3b403b"],
    ]),
    linear(
      "relief",
      [
        [0, "#a9ada3"],
        [0.5, tone[0]],
        [1, "#555b54"],
      ],
      1,
      1,
    ),
    radial(
      "spot",
      [
        [0, "#fff3d6", 0.35],
        [1, "#fff3d6", 0],
      ],
      0.5,
      0.25,
      0.6,
    ),
    el("filter", { id: "chisel", x: 0, y: 0, width: "100%", height: "100%" }, [
      el("feTurbulence", { type: "fractalNoise", baseFrequency: 0.7, numOctaves: 3, seed: seed % 50, result: "n" }),
      el("feDiffuseLighting", { in: "n", "lighting-color": "#ddd", surfaceScale: 1.6, result: "l" }, el("feDistantLight", { azimuth: 45, elevation: 55 })),
      el("feComposite", { in: "l", in2: "SourceGraphic", operator: "arithmetic", k1: 0.9, k2: 0, k3: 0, k4: 0 }),
    ]),
    shadowFilter("shadow", 30, 26, 0.6),
  ].join("");

  const archTop = y0 + ph * 0.18;
  const nw = pw * 0.62;
  const nx = cx - nw / 2;
  const nb = y0 + ph * 0.86;
  const niche = `M${f(nx)} ${f(nb)} V${f(archTop + nw * 0.5)} A${f(nw / 2)} ${f(nw / 2)} 0 0 1 ${f(nx + nw)} ${f(archTop + nw * 0.5)} V${f(nb)} Z`;
  // Stupa: base drums, dome, harmika, chattra (umbrellas)
  const sb = nb - ph * 0.04;
  const stupa = [
    el("rect", { x: cx - nw * 0.34, y: sb - ph * 0.06, width: nw * 0.68, height: ph * 0.06, fill: "url(#relief)" }),
    el("rect", { x: cx - nw * 0.28, y: sb - ph * 0.12, width: nw * 0.56, height: ph * 0.06, fill: "url(#relief)" }),
    el("path", {
      d: `M${f(cx - nw * 0.26)} ${f(sb - ph * 0.12)} A${f(nw * 0.26)} ${f(nw * 0.26)} 0 0 1 ${f(cx + nw * 0.26)} ${f(sb - ph * 0.12)} Z`,
      fill: "url(#relief)",
    }),
    el("rect", { x: cx - nw * 0.06, y: sb - ph * 0.12 - nw * 0.3, width: nw * 0.12, height: nw * 0.06, fill: "url(#relief)" }),
    el("rect", { x: cx - 3, y: sb - ph * 0.12 - nw * 0.52, width: 6, height: nw * 0.24, fill: "#8d9188" }),
    ...[0, 1, 2].map((i) =>
      el("ellipse", { cx, cy: f(sb - ph * 0.12 - nw * (0.34 + i * 0.07)), rx: f(nw * (0.13 - i * 0.03)), ry: f(nw * 0.018), fill: "url(#relief)" }),
    ),
  ];
  // Pilasters with Corinthian-like capitals (Greco-Buddhist)
  const pil = (x: number) =>
    el("g", {}, [
      el("rect", { x: x - pw * 0.035, y: archTop + nw * 0.2, width: pw * 0.07, height: nb - archTop - nw * 0.2, fill: "url(#relief)" }),
      el("rect", { x: x - pw * 0.055, y: archTop + nw * 0.16, width: pw * 0.11, height: pw * 0.05, fill: "#a4a89e" }),
      ...[0, 1, 2].map((k) =>
        el("line", {
          x1: f(x - pw * 0.02 + k * pw * 0.02),
          y1: f(archTop + nw * 0.24),
          x2: f(x - pw * 0.02 + k * pw * 0.02),
          y2: f(nb - 8),
          stroke: "#4c514b",
          "stroke-width": 2,
        }),
      ),
    ]);

  const body = [
    bg.back,
    bg.floor,
    el("g", { filter: "url(#shadow)" }, [
      el("rect", { x: x0, y: y0, width: pw, height: ph, fill: "url(#stoneFace)", rx: 6 }),
      el("rect", { x: x0, y: y0, width: pw, height: ph, fill: "url(#stoneFace)", filter: "url(#chisel)", opacity: 0.55, rx: 6 }),
      el("path", { d: niche, fill: "url(#niche)" }),
      el("path", { d: niche, fill: "none", stroke: "#9da196", "stroke-width": 8 }),
      pil(x0 + pw * 0.1),
      pil(x0 + pw * 0.9),
      ...stupa,
      el("rect", { x: x0, y: y0 + ph * 0.06, width: pw, height: ph * 0.05, fill: "#6b7068" }),
      ...Array.from({ length: 9 }, (_, i) =>
        el("rect", { x: f(x0 + (i + 0.3) * (pw / 9)), y: f(y0 + ph * 0.065), width: f(pw / 18), height: f(ph * 0.04), fill: "#8e9389" }),
      ),
      el("rect", { x: x0, y: y0, width: pw, height: ph, fill: "url(#spot)" }),
    ]),
    bg.front,
  ].join("");
  return svgDoc(c.w, c.h, body, defs, "Illustration: Gandhara-style stone relief");
}

// ── Himalayan salt lamp ─────────────────────────────────────────────────────

export function salt(seed: number, c: Canvas = { w: 1200, h: 1500 }) {
  const r = rng(seed);
  const bg = wall(c, r, "dark");
  const cx = c.w / 2;
  const scale = Math.min(c.w, c.h * 0.8);
  const cy = c.h * 0.45;
  const R = scale * 0.25;
  const pts: [number, number][] = [];
  const n = int(r, 11, 15);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const rr = R * range(r, 0.78, 1.08) * (Math.sin(a) > 0.6 ? 0.9 : 1);
    pts.push([cx + Math.cos(a) * rr * 0.86, cy + Math.sin(a) * rr * 1.18]);
  }
  const facets: string[] = [];
  for (let i = 0; i < n; i += 2) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    facets.push(
      el("polygon", {
        points: polygon([a, b, [cx + range(r, -R * 0.2, R * 0.2), cy + range(r, -R * 0.3, R * 0.3)]]),
        fill: "#ffd9b0",
        opacity: f(range(r, 0.06, 0.22)),
      }),
    );
  }
  const baseY = cy + R * 1.14;
  const defs = [
    bg.defs,
    radial(
      "saltGlow",
      [
        [0, "#fff1d6"],
        [0.35, "#ffb37e"],
        [0.75, "#e0704a"],
        [1, "#a23e2a"],
      ],
      0.5,
      0.55,
      0.6,
    ),
    radial(
      "halo",
      [
        [0, "#ff9a5c", 0.55],
        [0.5, "#ff7a45", 0.18],
        [1, "#ff7a45", 0],
      ],
      0.5,
      0.5,
      0.5,
    ),
    linear("wood", [
      [0, "#7a4b2b"],
      [1, "#3e2413"],
    ]),
    el("filter", { id: "blur" }, el("feGaussianBlur", { stdDeviation: 30 })),
  ].join("");
  const body = [
    bg.back,
    el("ellipse", { cx, cy, rx: R * 2.6, ry: R * 2.4, fill: "url(#halo)" }),
    bg.floor,
    el("ellipse", { cx, cy: baseY + R * 0.3, rx: R * 1.6, ry: R * 0.18, fill: "#ff9a5c", opacity: 0.25, filter: "url(#blur)" }),
    el("rect", { x: cx - R * 0.62, y: baseY, width: R * 1.24, height: R * 0.26, rx: 10, fill: "url(#wood)" }),
    el("polygon", { points: polygon(pts), fill: "url(#saltGlow)" }),
    ...facets,
    el("polygon", { points: polygon(pts), fill: "none", stroke: "#ffcfa3", "stroke-width": 2, opacity: 0.5 }),
    bg.front,
  ].join("");
  return svgDoc(c.w, c.h, body, defs, "Illustration: Himalayan salt lamp");
}

// ── Chiniot carved wood (jharokha / jali) ───────────────────────────────────

export function wood(seed: number, c: Canvas = { w: 1200, h: 1500 }) {
  const r = rng(seed);
  const bg = wall(c, r);
  const portrait = c.h >= c.w;
  const pw = portrait ? c.w * 0.58 : c.w * 0.36;
  const ph = portrait ? pw * 1.5 : c.h * 0.76;
  const x0 = (c.w - pw) / 2;
  const y0 = (c.h - ph) / 2 - c.h * 0.03;
  const woodTone = pick(r, [
    ["#8a5a34", "#4a2c16"],
    ["#6e4526", "#3a210f"],
    ["#9c6a3c", "#5a3a1e"],
  ]);
  const defs = [
    bg.defs,
    linear(
      "woodGrad",
      [
        [0, woodTone[0]],
        [1, woodTone[1]],
      ],
      1,
      1,
    ),
    el("filter", { id: "grainWood", x: 0, y: 0, width: "100%", height: "100%" }, [
      el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.004 0.09", numOctaves: 3, seed: seed % 40, result: "n" }),
      el("feColorMatrix", { in: "n", type: "matrix", values: "0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 0 0.03  0 0 0 0.6 0", result: "g" }),
      el("feComposite", { in: "g", in2: "SourceGraphic", operator: "atop" }),
    ]),
    shadowFilter("shadow", 26, 22, 0.45),
  ].join("");
  const archR = pw / 2;
  const outline = `M${f(x0)} ${f(y0 + ph)} V${f(y0 + archR)} A${f(archR)} ${f(archR)} 0 0 1 ${f(x0 + pw)} ${f(y0 + archR)} V${f(y0 + ph)} Z`;
  const inset = pw * 0.1;
  const ix = x0 + inset;
  const iw = pw - inset * 2;
  const iy = y0 + archR;
  const ih = ph - archR - inset;
  const cell = iw / 4;
  const holes: string[] = [];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < Math.floor(ih / cell); j++) {
      const hx = ix + cell * (i + 0.5);
      const hy = iy + cell * (j + 0.5);
      holes.push(el("polygon", { points: starPoints(hx, hy, cell * 0.42, cell * 0.2, 8), fill: "#1a0f08" }));
      holes.push(el("circle", { cx: f(hx), cy: f(hy), r: f(cell * 0.12), fill: "url(#woodGrad)" }));
    }
  const archInner = `M${f(ix)} ${f(iy)} A${f(iw / 2)} ${f(iw / 2)} 0 0 1 ${f(ix + iw)} ${f(iy)} Z`;
  const rosette = starPoints(x0 + pw / 2, iy - iw * 0.22, iw * 0.2, iw * 0.09, 12);
  const body = [
    bg.back,
    el("g", { filter: "url(#shadow)" }, [
      el("path", { d: outline, fill: "url(#woodGrad)", filter: "url(#grainWood)" }),
      el("path", { d: outline, fill: "none", stroke: "#2a170a", "stroke-width": 6 }),
      el("path", { d: archInner, fill: "#2a170a", opacity: 0.5 }),
      el("polygon", { points: rosette, fill: "#1a0f08" }),
      el("circle", { cx: x0 + pw / 2, cy: f(iy - iw * 0.22), r: f(iw * 0.06), fill: "url(#woodGrad)" }),
      el("rect", { x: ix - 6, y: iy - 6, width: iw + 12, height: ih + 12, fill: "#2a170a" }),
      el("rect", { x: ix, y: iy, width: iw, height: ih, fill: "url(#woodGrad)" }),
      ...holes,
    ]),
    bg.front,
  ].join("");
  return svgDoc(c.w, c.h, body, defs, "Illustration: Chiniot carved wood panel");
}

// ── Heritage print / poster ─────────────────────────────────────────────────

export function print(seed: number, c: Canvas = { w: 1200, h: 1500 }, opts: SurfaceOpts = {}) {
  const r = rng(seed);
  const bg = layers(wall(c, r), opts);
  const scheme = pick(r, [
    { sky: "#f0dcc0", sun: "#c4623a", arch: "#25305a", water: "#34498a" },
    { sky: "#1b2140", sun: "#e2c27a", arch: "#b5532e", water: "#25305a" },
    { sky: "#e7eef0", sun: "#2a9da8", arch: "#8f1f24", water: "#7cc9cf" },
    { sky: "#f6e6d0", sun: "#8f1f24", arch: "#1f7a5a", water: "#2a9da8" },
  ]);
  const portrait = c.h >= c.w;
  const pw = opts.surface ? c.w : portrait ? c.w * 0.64 : c.w * 0.44;
  const ph = opts.surface ? c.h : portrait ? pw * 1.38 : c.h * 0.78;
  const x0 = opts.surface ? 0 : (c.w - pw) / 2;
  const y0 = opts.surface ? 0 : (c.h - ph) / 2 - c.h * 0.03;
  const m = pw * 0.07;
  const ax = x0 + m;
  const aw = pw - 2 * m;
  const ay = y0 + m;
  const ah = ph * 0.74;
  const horizon = ay + ah * 0.72;
  const cx = ax + aw / 2;
  // Mughal skyline: central dome, two side domes, four minarets
  const dome = (x: number, w: number, h: number) =>
    `M${f(x - w / 2)} ${f(horizon - h * 0.35)} C${f(x - w / 2)} ${f(horizon - h)} ${f(x + w / 2)} ${f(horizon - h)} ${f(x + w / 2)} ${f(horizon - h * 0.35)} Z`;
  const minaret = (x: number, h: number) =>
    el("g", {}, [
      el("rect", { x: f(x - aw * 0.018), y: f(horizon - h), width: f(aw * 0.036), height: f(h), fill: scheme.arch }),
      el("path", {
        d: `M${f(x - aw * 0.03)} ${f(horizon - h)} Q ${f(x)} ${f(horizon - h - aw * 0.07)} ${f(x + aw * 0.03)} ${f(horizon - h)} Z`,
        fill: scheme.arch,
      }),
      el("rect", { x: f(x - aw * 0.03), y: f(horizon - h * 0.7), width: f(aw * 0.06), height: 6, fill: scheme.arch }),
    ]);
  const skyline = [
    el("rect", { x: f(cx - aw * 0.34), y: f(horizon - ah * 0.2), width: f(aw * 0.68), height: f(ah * 0.2), fill: scheme.arch }),
    el("path", { d: dome(cx, aw * 0.3, ah * 0.52), fill: scheme.arch }),
    el("path", { d: dome(cx - aw * 0.22, aw * 0.14, ah * 0.36), fill: scheme.arch }),
    el("path", { d: dome(cx + aw * 0.22, aw * 0.14, ah * 0.36), fill: scheme.arch }),
    ...[-0.42, 0.42].map((k) => minaret(cx + aw * k, ah * 0.52)),
    ...[-0.28, 0.28].map((k) => minaret(cx + aw * k, ah * 0.36)),
    ...[-0.2, 0, 0.2].map((k) =>
      el("path", {
        d: `M${f(cx + aw * k - aw * 0.04)} ${f(horizon)} V${f(horizon - ah * 0.1)} A${f(aw * 0.04)} ${f(aw * 0.04)} 0 0 1 ${f(cx + aw * k + aw * 0.04)} ${f(horizon - ah * 0.1)} V${f(horizon)} Z`,
        fill: scheme.sky,
        opacity: 0.9,
      }),
    ),
  ];
  const defs = [bg.defs, shadowFilter("shadow", 22, 18, 0.35), grainFilter("ink", 0.2, 1.3)].join("");
  const body = [
    bg.back,
    el("g", { filter: "url(#shadow)" }, [
      el("rect", { x: x0, y: y0, width: pw, height: ph, fill: "#fbf6ec" }),
      el("g", { filter: "url(#ink)" }, [
        el("rect", { x: ax, y: ay, width: aw, height: ah, fill: scheme.sky }),
        el("circle", { cx: f(cx), cy: f(ay + ah * 0.3), r: f(aw * 0.24), fill: scheme.sun, opacity: 0.9 }),
        ...skyline,
        el("rect", { x: ax, y: horizon, width: aw, height: ay + ah - horizon, fill: scheme.water }),
        ...Array.from({ length: 6 }, (_, i) =>
          el("rect", {
            x: f(ax + aw * (0.1 + i * 0.13)),
            y: f(horizon + (ay + ah - horizon) * (0.2 + (i % 3) * 0.25)),
            width: f(aw * 0.08),
            height: 3,
            fill: scheme.sky,
            opacity: 0.5,
          }),
        ),
      ]),
      el("rect", { x: ax, y: f(ay + ah + ph * 0.05), width: f(aw * 0.5), height: f(ph * 0.022), fill: scheme.arch }),
      el("rect", { x: ax, y: f(ay + ah + ph * 0.1), width: f(aw * 0.32), height: f(ph * 0.012), fill: "#b9ab92" }),
      el("rect", { x: ax, y: f(ay + ah + ph * 0.13), width: f(aw * 0.24), height: f(ph * 0.012), fill: "#b9ab92" }),
      el("polygon", { points: starPoints(ax + aw - ph * 0.05, ay + ah + ph * 0.1, ph * 0.04, ph * 0.018, 8), fill: scheme.sun }),
    ]),
    bg.front,
  ].join("");
  return svgDoc(c.w, c.h, body, defs, "Illustration: heritage architecture print");
}

// ── Ajrak block print (Sindh) ───────────────────────────────────────────────

export function ajrakPattern(id: string, size: number, seed: number) {
  const r = rng(seed);
  const red = pick(r, ["#8f1f24", "#9e2a2b", "#7a1a1f"]);
  const indigo = pick(r, ["#1b2140", "#1f2a4f"]);
  const s = size;
  return el("pattern", { id, width: s, height: s, patternUnits: "userSpaceOnUse" }, [
    el("rect", { width: s, height: s, fill: red }),
    el("polygon", { points: starPoints(s / 2, s / 2, s * 0.46, s * 0.3, 8), fill: indigo }),
    el("polygon", { points: starPoints(s / 2, s / 2, s * 0.3, s * 0.16, 8, Math.PI / 8), fill: red, stroke: "#f3ead6", "stroke-width": s * 0.018 }),
    el("circle", { cx: s / 2, cy: s / 2, r: s * 0.07, fill: "#f3ead6" }),
    ...[
      [0, 0],
      [s, 0],
      [0, s],
      [s, s],
    ].map(([x, y]) => el("circle", { cx: x, cy: y, r: s * 0.12, fill: indigo, stroke: "#f3ead6", "stroke-width": s * 0.015 })),
    ...[0.25, 0.75].flatMap((k) => [
      el("circle", { cx: s * k, cy: s * 0.04, r: s * 0.02, fill: "#f3ead6" }),
      el("circle", { cx: s * 0.04, cy: s * k, r: s * 0.02, fill: "#f3ead6" }),
    ]),
  ]);
}

export function ajrak(seed: number, c: Canvas = { w: 1200, h: 1500 }, opts: SurfaceOpts = {}) {
  const r = rng(seed);
  const bg = layers(wall(c, r), opts);
  const portrait = c.h >= c.w;
  const pw = opts.surface ? c.w : portrait ? c.w * 0.66 : c.w * 0.5;
  const ph = opts.surface ? c.h : portrait ? pw * 1.3 : c.h * 0.76;
  const x0 = opts.surface ? 0 : (c.w - pw) / 2;
  const y0 = opts.surface ? 0 : (c.h - ph) / 2 - c.h * 0.02;
  const band = pw * 0.07;
  const defs = [
    bg.defs,
    ajrakPattern("ajrak", pw / 5, seed),
    el("pattern", { id: "ajrakBorder", width: band, height: band, patternUnits: "userSpaceOnUse" }, [
      el("rect", { width: band, height: band, fill: "#1b2140" }),
      el("polygon", {
        points: polygon([
          [band / 2, band * 0.1],
          [band * 0.9, band / 2],
          [band / 2, band * 0.9],
          [band * 0.1, band / 2],
        ]),
        fill: "#8f1f24",
        stroke: "#f3ead6",
        "stroke-width": 2,
      }),
    ]),
    shadowFilter("shadow", 24, 20, 0.35),
    grainFilter("cloth", 0.28, 1.6),
    // Gentle cloth folds
    linear(
      "folds",
      [
        [0, "#000", 0.12],
        [0.2, "#fff", 0.06],
        [0.45, "#000", 0.14],
        [0.7, "#fff", 0.05],
        [1, "#000", 0.12],
      ],
      1,
      0,
    ),
  ].join("");
  const body = [
    bg.back,
    bg.floor,
    el("g", { filter: "url(#shadow)" }, [
      el("g", { filter: "url(#cloth)" }, [
        el("rect", { x: x0, y: y0, width: pw, height: ph, fill: "url(#ajrakBorder)" }),
        el("rect", { x: x0 + band, y: y0 + band, width: pw - 2 * band, height: ph - 2 * band, fill: "url(#ajrak)" }),
      ]),
      el("rect", { x: x0, y: y0, width: pw, height: ph, fill: "url(#folds)" }),
    ]),
    bg.front,
  ].join("");
  return svgDoc(c.w, c.h, body, defs, "Illustration: Sindhi ajrak block print");
}

// ── Kashi tile (Multan / Hala) ──────────────────────────────────────────────

export function tilePattern(id: string, s: number, seed: number) {
  const r = rng(seed);
  const blue = pick(r, ["#2f5ea8", "#1f4f9a", "#25305a"]);
  const turq = pick(r, ["#2a9da8", "#3aa7b0"]);
  return el("pattern", { id, width: s, height: s, patternUnits: "userSpaceOnUse" }, [
    el("rect", { width: s, height: s, fill: "#f7f3ea" }),
    el("polygon", { points: starPoints(s / 2, s / 2, s * 0.48, s * 0.34, 8), fill: blue }),
    el("polygon", { points: starPoints(s / 2, s / 2, s * 0.32, s * 0.2, 8, Math.PI / 8), fill: "#f7f3ea" }),
    el("circle", { cx: s / 2, cy: s / 2, r: s * 0.12, fill: turq }),
    ...[
      [0, 0],
      [s, 0],
      [0, s],
      [s, s],
    ].map(([x, y]) =>
      el("polygon", {
        points: polygon([
          [x, y - s * 0.16],
          [x + s * 0.16, y],
          [x, y + s * 0.16],
          [x - s * 0.16, y],
        ]),
        fill: turq,
      }),
    ),
    el("rect", { width: s, height: s, fill: "none", stroke: "#d9d2c0", "stroke-width": 1.5 }),
  ]);
}

export function tile(seed: number, c: Canvas = { w: 1200, h: 1500 }) {
  const size = Math.min(c.w, c.h) / int(rng(seed), 4, 6);
  const defs = [
    tilePattern("tile", size, seed),
    grainFilter("glaze", 0.1, 1.1),
    radial(
      "shine",
      [
        [0, "#fff", 0.25],
        [1, "#fff", 0],
      ],
      0.3,
      0.2,
      0.7,
    ),
  ].join("");
  return svgDoc(
    c.w,
    c.h,
    el("rect", { width: c.w, height: c.h, fill: "url(#tile)", filter: "url(#glaze)" }) + el("rect", { width: c.w, height: c.h, fill: "url(#shine)" }),
    defs,
    "Illustration: kashi tilework",
  );
}

// ── Avatars & banners (demo artisans only) ──────────────────────────────────

export function avatar(seed: number, c: Canvas = { w: 480, h: 480 }) {
  const r = rng(seed);
  const colors = pick(r, [
    ["#25305a", "#e2c27a", "#b5532e"],
    ["#8f1f24", "#f1e2b6", "#25305a"],
    ["#1f7a5a", "#f1e2b6", "#b8893b"],
    ["#b5532e", "#f5eee1", "#25305a"],
    ["#2a9da8", "#f7f3ea", "#25305a"],
  ]);
  const cx = c.w / 2;
  const cy = c.h / 2;
  const R = Math.min(c.w, c.h) / 2;
  const points = pick(r, [8, 10, 12]);
  const rings = [
    el("rect", { width: c.w, height: c.h, fill: colors[0] }),
    el("circle", { cx, cy, r: R * 0.86, fill: "none", stroke: colors[1], "stroke-width": R * 0.03, opacity: 0.6 }),
    el("polygon", { points: starPoints(cx, cy, R * 0.72, R * 0.46, points), fill: colors[1] }),
    el("polygon", { points: starPoints(cx, cy, R * 0.48, R * 0.28, points, Math.PI / points), fill: colors[2] }),
    el("circle", { cx, cy, r: R * 0.18, fill: colors[1] }),
    el("circle", { cx, cy, r: R * 0.08, fill: colors[0] }),
  ];
  return svgDoc(c.w, c.h, rings.join(""), grainFilter("g", 0.12), "Illustrated emblem (demo artisan)");
}

export function banner(seed: number, c: Canvas = { w: 2000, h: 700 }) {
  const r = rng(seed);
  const style = seed % 3;
  const defs = [
    style === 0 ? ajrakPattern("p", c.h / 3, seed) : tilePattern("p", c.h / (style === 1 ? 3 : 2.2), seed),
    linear(
      "fade",
      [
        [0, "#15192e", 0.1],
        [0.6, "#15192e", 0.35],
        [1, "#15192e", 0.75],
      ],
      0,
      1,
    ),
    grainFilter("g", 0.14),
  ].join("");
  const accent = pick(r, ["#b5532e", "#b8893b", "#2a9da8", "#8f1f24"]);
  return svgDoc(
    c.w,
    c.h,
    [
      el("rect", { width: c.w, height: c.h, fill: "url(#p)", filter: "url(#g)" }),
      el("rect", { width: c.w, height: c.h, fill: "url(#fade)" }),
      el("rect", { y: c.h - 10, width: c.w, height: 10, fill: accent }),
    ].join(""),
    defs,
    "Illustrated banner pattern",
  );
}

// ── Heritage furniture (Chiniot carved sheesham) ───────────────────────────

export function furniture(seed: number, c: Canvas = { w: 1200, h: 1500 }) {
  const r = rng(seed);
  const bg = wall(c, r);
  const tone = pick(r, [
    ["#7a4a28", "#3d2412"],
    ["#8f5a33", "#4a2c16"],
    ["#5e3a20", "#2c190b"],
  ]);
  const defs = [
    bg.defs,
    linear(
      "fWood",
      [
        [0, tone[0]],
        [1, tone[1]],
      ],
      1,
      1,
    ),
    el("filter", { id: "fGrain", x: 0, y: 0, width: "100%", height: "100%" }, [
      el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.005 0.08", numOctaves: 3, seed: seed % 40, result: "n" }),
      el("feColorMatrix", { in: "n", type: "matrix", values: "0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 0 0.03  0 0 0 0.55 0", result: "g" }),
      el("feComposite", { in: "g", in2: "SourceGraphic", operator: "atop" }),
    ]),
    shadowFilter("fShadow", 20, 18, 0.4),
  ].join("");
  const dark = "#1f1208";
  const cx = c.w / 2;
  const floorY = bg.floorY;
  const parts: string[] = [];
  const rosette = (x: number, y: number, rad: number) => [
    el("polygon", { points: starPoints(x, y, rad, rad * 0.45, 8), fill: dark, opacity: 0.85 }),
    el("circle", { cx: f(x), cy: f(y), r: f(rad * 0.28), fill: "url(#fWood)" }),
  ];
  if (seed % 2 === 0) {
    // Sideboard with two arched, carved doors on turned legs.
    const w = c.w * 0.72;
    const h = w * 0.62;
    const x0 = cx - w / 2;
    const legH = h * 0.18;
    const y0 = floorY - legH - h;
    parts.push(
      el("rect", { x: f(x0 - w * 0.03), y: f(y0 - h * 0.06), width: f(w * 1.06), height: f(h * 0.07), rx: 6, fill: "url(#fWood)", filter: "url(#fGrain)" }),
    );
    parts.push(el("rect", { x: f(x0), y: f(y0), width: f(w), height: f(h), fill: "url(#fWood)", filter: "url(#fGrain)" }));
    parts.push(el("rect", { x: f(x0), y: f(y0), width: f(w), height: f(h), fill: "none", stroke: dark, "stroke-width": 5 }));
    const dw = (w - w * 0.12) / 2;
    for (const k of [0, 1]) {
      const dx = x0 + w * 0.04 + k * (dw + w * 0.04);
      const dy = y0 + h * 0.08;
      const dh = h * 0.84;
      const ar = dw / 2 - dw * 0.1;
      const ix = dx + dw * 0.1;
      const iw = dw * 0.8;
      parts.push(el("rect", { x: f(dx), y: f(dy), width: f(dw), height: f(dh), fill: dark, opacity: 0.35 }));
      parts.push(
        el("path", {
          d: `M${f(ix)} ${f(dy + dh - dh * 0.08)} V${f(dy + ar + dh * 0.08)} A${f(ar)} ${f(ar)} 0 0 1 ${f(ix + iw)} ${f(dy + ar + dh * 0.08)} V${f(dy + dh - dh * 0.08)} Z`,
          fill: "url(#fWood)",
          stroke: dark,
          "stroke-width": 3,
        }),
      );
      parts.push(...rosette(ix + iw / 2, dy + ar + dh * 0.1, iw * 0.2));
      for (let j = 0; j < 3; j++)
        parts.push(el("circle", { cx: f(ix + iw / 2), cy: f(dy + dh * (0.58 + j * 0.1)), r: f(iw * 0.06), fill: dark, opacity: 0.7 }));
      parts.push(el("circle", { cx: f(k === 0 ? dx + dw - dw * 0.06 : dx + dw * 0.06), cy: f(dy + dh * 0.55), r: 7, fill: PALETTE.goldLight }));
    }
    for (const lx of [x0 + w * 0.04, x0 + w - w * 0.04 - w * 0.05]) {
      parts.push(
        el("path", {
          d: `M${f(lx)} ${f(y0 + h)} h${f(w * 0.05)} l${f(-w * 0.008)} ${f(legH * 0.5)} q${f(w * 0.012)} ${f(legH * 0.2)} 0 ${f(legH * 0.5)} h${f(-w * 0.034)} q${f(-w * 0.012)} ${f(-legH * 0.3)} 0 ${f(-legH * 0.5)} z`,
          fill: "url(#fWood)",
          stroke: dark,
          "stroke-width": 2,
        }),
      );
    }
  } else {
    // Armchair with an arched, pierced back.
    const w = c.w * 0.46;
    const seatY = floorY - w * 0.55;
    const x0 = cx - w / 2;
    const backTop = seatY - w * 1.0;
    const ar = w * 0.42;
    parts.push(
      el("path", {
        d: `M${f(x0 + w * 0.08)} ${f(seatY)} V${f(backTop + ar)} A${f(ar)} ${f(ar)} 0 0 1 ${f(x0 + w * 0.92)} ${f(backTop + ar)} V${f(seatY)} Z`,
        fill: "url(#fWood)",
        filter: "url(#fGrain)",
        stroke: dark,
        "stroke-width": 5,
      }),
    );
    const iw = w * 0.6;
    const ix = cx - iw / 2;
    const iar = iw / 2;
    parts.push(
      el("path", {
        d: `M${f(ix)} ${f(seatY - w * 0.08)} V${f(backTop + ar + w * 0.02)} A${f(iar)} ${f(iar)} 0 0 1 ${f(ix + iw)} ${f(backTop + ar + w * 0.02)} V${f(seatY - w * 0.08)} Z`,
        fill: dark,
        opacity: 0.55,
      }),
    );
    parts.push(...rosette(cx, backTop + ar + w * 0.02, iw * 0.24));
    for (let j = 0; j < 3; j++) parts.push(...rosette(cx, backTop + ar + w * (0.3 + j * 0.2), iw * 0.1));
    parts.push(
      el("rect", { x: f(x0 - w * 0.04), y: f(seatY), width: f(w * 1.08), height: f(w * 0.1), rx: 8, fill: "url(#fWood)", stroke: dark, "stroke-width": 3 }),
    );
    parts.push(
      el("rect", {
        x: f(x0 + w * 0.04),
        y: f(seatY - w * 0.12),
        width: f(w * 0.92),
        height: f(w * 0.12),
        rx: 14,
        fill: pick(r, [PALETTE.madder, PALETTE.indigo, "#1f5a4a"]),
      }),
    );
    for (const lx of [x0, x0 + w - w * 0.08])
      parts.push(
        el("rect", {
          x: f(lx),
          y: f(seatY + w * 0.1),
          width: f(w * 0.08),
          height: f(floorY - seatY - w * 0.1),
          fill: "url(#fWood)",
          stroke: dark,
          "stroke-width": 2,
        }),
      );
    parts.push(el("rect", { x: f(x0 + w * 0.08), y: f(seatY + w * 0.34), width: f(w * 0.84), height: f(w * 0.04), fill: dark, opacity: 0.8 }));
  }
  const body = [bg.back, bg.floor, el("g", { filter: "url(#fShadow)" }, parts), bg.front].join("");
  return svgDoc(c.w, c.h, body, defs, "Illustration: Chiniot carved furniture");
}

// ── Snooker & games tables ─────────────────────────────────────────────────

export function snooker(seed: number, c: Canvas = { w: 1600, h: 1000 }) {
  const r = rng(seed);
  const bg = wall(c, r, "dark");
  const cloth = pick(r, [
    ["#1f7a4a", "#12532f"],
    ["#2a6f9a", "#174a6b"],
    ["#8f1f24", "#5c1216"],
  ]);
  const woodTone = pick(r, [
    ["#6e4526", "#2f1a0b"],
    ["#8a5a34", "#3d2412"],
  ]);
  const landscape = c.w >= c.h;
  const tw = landscape ? c.w * 0.8 : c.w * 0.62;
  const th = landscape ? tw * 0.52 : tw * 1.9;
  const x0 = (c.w - tw) / 2;
  const y0 = (c.h - th) / 2;
  const rail = Math.min(tw, th) * 0.07;
  const defs = [
    radial(
      "cloth",
      [
        [0, cloth[0]],
        [1, cloth[1]],
      ],
      0.5,
      0.5,
      0.7,
    ),
    linear(
      "rail",
      [
        [0, woodTone[0]],
        [1, woodTone[1]],
      ],
      1,
      1,
    ),
    radial(
      "lamp",
      [
        [0, "#fff6d8", 0.35],
        [1, "#fff6d8", 0],
      ],
      0.5,
      0.5,
      0.5,
    ),
    shadowFilter("tShadow", 26, 30, 0.6),
    bg.defs,
  ].join("");
  const ix = x0 + rail;
  const iy = y0 + rail;
  const iw = tw - rail * 2;
  const ih = th - rail * 2;
  const pocketR = rail * 0.55;
  const pockets = landscape
    ? [
        [ix, iy],
        [ix + iw / 2, iy - rail * 0.15],
        [ix + iw, iy],
        [ix, iy + ih],
        [ix + iw / 2, iy + ih + rail * 0.15],
        [ix + iw, iy + ih],
      ]
    : [
        [ix, iy],
        [ix + iw, iy],
        [ix - rail * 0.15, iy + ih / 2],
        [ix + iw + rail * 0.15, iy + ih / 2],
        [ix, iy + ih],
        [ix + iw, iy + ih],
      ];
  const ball = Math.min(iw, ih) * 0.028;
  // Rack of reds as a triangle near the top/right end.
  const balls: string[] = [];
  const along = (t: number, across: number) => (landscape ? [ix + iw * t, iy + ih / 2 + across] : [ix + iw / 2 + across, iy + ih * (1 - t)]);
  for (let row = 0; row < 5; row++)
    for (let k = 0; k <= row; k++) {
      const [bx, by] = along(0.74 + row * 0.022, (k - row / 2) * ball * 2.05);
      balls.push(el("circle", { cx: f(bx), cy: f(by), r: f(ball), fill: "#b3121c" }));
    }
  const colours: [number, number, string][] = [
    [0.715, 0, "#f06aa6"],
    [0.9, 0, "#111"],
    [0.5, 0, "#2255c4"],
    [0.2, 0, "#7a4a28"],
    [0.2, ih * 0.08, "#1b8a3a"],
    [0.2, -ih * 0.08, "#e7c32a"],
    [0.12, ih * 0.03, "#f7f3ea"],
  ];
  for (const [t, a, col] of colours) {
    const [bx, by] = along(t, landscape ? a : a * (iw / ih));
    balls.push(el("circle", { cx: f(bx), cy: f(by), r: f(ball), fill: col }));
  }
  const [bl1x, bl1y] = along(0.2, landscape ? -ih / 2 : -iw / 2);
  const [bl2x, bl2y] = along(0.2, landscape ? ih / 2 : iw / 2);
  const [dcx, dcy] = along(0.2, 0);
  const dR = (landscape ? ih : iw) * 0.08;
  const dArc = landscape
    ? `M${f(dcx)} ${f(dcy - dR)} A${f(dR)} ${f(dR)} 0 0 0 ${f(dcx)} ${f(dcy + dR)}`
    : `M${f(dcx - dR)} ${f(dcy)} A${f(dR)} ${f(dR)} 0 0 0 ${f(dcx + dR)} ${f(dcy)}`;
  const body = [
    bg.back,
    el("ellipse", { cx: c.w / 2, cy: c.h / 2, rx: f(tw * 0.6), ry: f(th * 0.7), fill: "url(#lamp)" }),
    el("g", { filter: "url(#tShadow)" }, [
      el("rect", { x: f(x0), y: f(y0), width: f(tw), height: f(th), rx: f(rail * 0.6), fill: "url(#rail)" }),
      el("rect", {
        x: f(x0 + rail * 0.3),
        y: f(y0 + rail * 0.3),
        width: f(tw - rail * 0.6),
        height: f(th - rail * 0.6),
        rx: f(rail * 0.4),
        fill: "none",
        stroke: PALETTE.goldLight,
        "stroke-opacity": 0.35,
        "stroke-width": 2,
      }),
      el("rect", { x: f(ix), y: f(iy), width: f(iw), height: f(ih), fill: "url(#cloth)" }),
      el("rect", { x: f(ix), y: f(iy), width: f(iw), height: f(ih), fill: "none", stroke: "#000", "stroke-opacity": 0.35, "stroke-width": rail * 0.18 }),
    ]),
    el("line", { x1: f(bl1x), y1: f(bl1y), x2: f(bl2x), y2: f(bl2y), stroke: "#fff", "stroke-opacity": 0.5, "stroke-width": 2 }),
    el("path", { d: dArc, fill: "none", stroke: "#fff", "stroke-opacity": 0.5, "stroke-width": 2 }),
    ...pockets.map(([px, py]) => el("circle", { cx: f(px), cy: f(py), r: f(pocketR), fill: "#0a0705" })),
    ...Array.from({ length: 9 }, (_, i) => {
      const t = (i + 1) / 10;
      return landscape
        ? el("circle", { cx: f(x0 + tw * t), cy: f(y0 + rail * 0.5), r: 4, fill: PALETTE.goldPale, opacity: 0.8 })
        : el("circle", { cx: f(x0 + rail * 0.5), cy: f(y0 + th * t), r: 4, fill: PALETTE.goldPale, opacity: 0.8 });
    }),
    ...balls,
    bg.front,
  ].join("");
  return svgDoc(c.w, c.h, body, defs, "Illustration: snooker table");
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export function renderArt(kind: ArtKind, seed: number, size?: { w: number; h: number }) {
  switch (kind) {
    case "rug":
      return rug(seed, size);
    case "calligraphy":
      return calligraphy(seed, size);
    case "pottery":
      return pottery(seed, size);
    case "truckart":
      return truckart(seed, size);
    case "stone":
      return stone(seed, size);
    case "salt":
      return salt(seed, size);
    case "wood":
      return wood(seed, size);
    case "print":
      return print(seed, size);
    case "ajrak":
      return ajrak(seed, size);
    case "tile":
      return tile(seed, size);
    case "furniture":
      return furniture(seed, size);
    case "snooker":
      return snooker(seed, size);
    case "avatar":
      return avatar(seed, size);
    case "banner":
      return banner(seed, size);
  }
}
