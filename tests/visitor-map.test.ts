import { describe, expect, it } from "vitest";
import { clusterPoints, crossSize, zoomToSeparate } from "@/components/admin/visitor-map/cluster";
import {
  baseToScreen,
  clampK,
  clampView,
  easeInOutCubic,
  estimateVelocity,
  fitBaseProjection,
  homeView,
  INERTIA_DURATION,
  INERTIA_TAU,
  inertiaOffset,
  inertiaVelocity,
  interpolateZoom,
  levelToK,
  lngLatToScreen,
  MAX_K,
  MIN_K,
  panBy,
  screenToBase,
  screenToLngLat,
  wheelFactor,
  zoomAround,
} from "@/components/admin/visitor-map/geo";
import { alpha2ToNumeric, numericToAlpha2 } from "@/components/admin/visitor-map/iso-numeric";
import { buildScreenMarkers } from "@/components/admin/visitor-map/markers";
import { DEFAULT_SETTINGS, sanitizeSettings } from "@/components/admin/visitor-map/settings";
import type { GeoMarker, ProjectionName } from "@/components/admin/visitor-map/types";
import { buildMarkers, filterValue } from "@/components/admin/visitor-map/data";
import fixture from "./fixtures/visitor-map.json";

const vp = { width: 1200, height: 800 };

describe("zoom maths", () => {
  it("wheel factor is e^(−Δy·0.0022)", () => {
    expect(wheelFactor(-100)).toBeCloseTo(Math.exp(0.22), 10);
    expect(wheelFactor(100)).toBeCloseTo(Math.exp(-0.22), 10);
    expect(wheelFactor(0)).toBe(1);
    // Up then down by the same amount cancels out.
    expect(wheelFactor(-80) * wheelFactor(80)).toBeCloseTo(1, 12);
  });

  it("caps each wheel step", () => {
    expect(wheelFactor(-10_000)).toBeCloseTo(Math.exp(0.5), 10);
    expect(wheelFactor(10_000)).toBeCloseTo(Math.exp(-0.5), 10);
  });

  it("normalises line and page wheel modes", () => {
    expect(wheelFactor(-3, 1)).toBeCloseTo(Math.exp(48 * 0.0022), 10);
    expect(wheelFactor(1, 2, 100)).toBeCloseTo(Math.exp(-0.22), 10);
  });

  it("clamps zoom between the whole world and ~400×", () => {
    expect(MIN_K).toBe(1);
    expect(MAX_K).toBe(400);
    expect(clampK(0.2)).toBe(1);
    expect(clampK(1000)).toBe(400);
    expect(clampK(12)).toBe(12);
    const v = zoomAround({ cx: 10, cy: 20, k: 300 }, 4, 600, 400, vp);
    expect(v.k).toBe(400);
  });

  it("zooming keeps the point under the cursor fixed", () => {
    const v0 = { cx: 500, cy: 300, k: 2 };
    const cursor: [number, number] = [900, 150];
    const b0 = screenToBase(v0, vp, ...cursor);
    const v1 = zoomAround(v0, 3.7, ...cursor, vp);
    const s1 = baseToScreen(v1, vp, ...b0);
    expect(s1[0]).toBeCloseTo(cursor[0], 9);
    expect(s1[1]).toBeCloseTo(cursor[1], 9);
    expect(v1.k).toBeCloseTo(7.4, 12);
  });

  it("zooming around the centre doesn't move the centre", () => {
    const v1 = zoomAround({ cx: 123, cy: 456, k: 1 }, 1.6, vp.width / 2, vp.height / 2, vp);
    expect(v1).toEqual({ cx: 123, cy: 456, k: 1.6 });
  });

  it("screen ↔ base round trip and panning", () => {
    const v = { cx: 640, cy: 410, k: 13.5 };
    const [bx, by] = screenToBase(v, vp, 77, 999);
    const [sx, sy] = baseToScreen(v, vp, bx, by);
    expect(sx).toBeCloseTo(77, 9);
    expect(sy).toBeCloseTo(999, 9);
    const moved = panBy(v, 27, -54);
    expect(moved.cx).toBeCloseTo(640 - 2, 12);
    expect(moved.cy).toBeCloseTo(410 + 4, 12);
  });

  it("clampView keeps the centre over the world", () => {
    const v = clampView({ cx: -500, cy: 9999, k: 0.5 }, [
      [0, 0],
      [100, 50],
    ]);
    expect(v).toEqual({ cx: 0, cy: 50, k: 1 });
  });

  it("levels map to powers of two", () => {
    expect(levelToK(1)).toBe(1);
    expect(levelToK(5)).toBe(16);
  });

  it("ease-in-out cubic is symmetric with fixed ends", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
    expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1, 12);
  });

  it("interpolateZoom starts and ends exactly at the two views", () => {
    const f = interpolateZoom([0, 0, 1200], [800, -300, 75]);
    expect(f(0)[0]).toBeCloseTo(0, 6);
    expect(f(0)[2]).toBeCloseTo(1200, 6);
    const end = f(1);
    expect(end[0]).toBeCloseTo(800, 6);
    expect(end[1]).toBeCloseTo(-300, 6);
    expect(end[2]).toBeCloseTo(75, 6);
    // Pure zoom (same centre).
    const g = interpolateZoom([5, 5, 100], [5, 5, 25]);
    expect(g(0.5)[2]).toBeCloseTo(50, 6);
  });
});

describe("inertia", () => {
  it("decays exponentially and is ~95% done within 300 ms", () => {
    const v = 1.2; // px/ms
    const total = v * INERTIA_TAU;
    expect(inertiaOffset(v, 0)).toBe(0);
    expect(inertiaOffset(v, INERTIA_DURATION) / total).toBeGreaterThan(0.95);
    expect(inertiaOffset(v, INERTIA_DURATION)).toBeLessThan(total);
    expect(inertiaVelocity(v, INERTIA_TAU)).toBeCloseTo(v / Math.E, 12);
    // Monotonic, slowing down.
    const a = inertiaOffset(v, 50);
    const b = inertiaOffset(v, 100) - a;
    expect(b).toBeLessThan(a);
  });

  it("estimates release velocity from recent samples only", () => {
    const samples = [
      { x: 0, y: 0, t: 0 },
      { x: 500, y: 0, t: 10 }, // old, ignored
      { x: 500, y: 0, t: 200 },
      { x: 540, y: 20, t: 220 },
      { x: 580, y: 40, t: 240 },
    ];
    const [vx, vy] = estimateVelocity(samples);
    expect(vx).toBeCloseTo(2, 9);
    expect(vy).toBeCloseTo(1, 9);
    expect(estimateVelocity([{ x: 1, y: 1, t: 5 }])).toEqual([0, 0]);
    // A burst with identical timestamps counts as one 16 ms frame, and flings are capped.
    const [bx] = estimateVelocity([
      { x: 0, y: 0, t: 100 },
      { x: 32, y: 0, t: 100 },
    ]);
    expect(bx).toBeCloseTo(2, 9);
    const [fx, fy] = estimateVelocity([
      { x: 0, y: 0, t: 0 },
      { x: 3000, y: 4000, t: 20 },
    ]);
    expect(Math.hypot(fx, fy)).toBeCloseTo(3, 9);
  });
});

describe("projections", () => {
  const names: ProjectionName[] = ["naturalEarth", "equirectangular", "mercator"];
  const places: [number, number][] = [
    [74.3587, 31.5204], // Lahore
    [-0.1278, 51.5074], // London
    [-74.006, 40.7128], // New York
    [151.2093, -33.8688], // Sydney
    [8, 22], // home
  ];
  for (const name of names) {
    it(`${name}: lng/lat → screen → lng/lat round trip at several zooms`, () => {
      const bp = fitBaseProjection(name, vp);
      for (const view of [homeView(bp), { cx: 700, cy: 300, k: 6.3 }, { cx: 900, cy: 260, k: 250 }]) {
        for (const [lng, lat] of places) {
          const s = lngLatToScreen(bp, view, vp, lng, lat)!;
          const back = screenToLngLat(bp, view, vp, s[0], s[1])!;
          expect(back[0]).toBeCloseTo(lng, 4);
          expect(back[1]).toBeCloseTo(lat, 4);
        }
      }
    });
    it(`${name}: the whole world fits the viewport at zoom 1`, () => {
      const bp = fitBaseProjection(name, vp);
      const [[x0, y0], [x1, y1]] = bp.bounds;
      expect(x0).toBeGreaterThanOrEqual(7);
      expect(y0).toBeGreaterThanOrEqual(7);
      expect(x1).toBeLessThanOrEqual(vp.width - 7);
      expect(y1).toBeLessThanOrEqual(vp.height - 7);
      const h = homeView(bp);
      const centre = screenToLngLat(bp, h, vp, vp.width / 2, vp.height / 2)!;
      expect(centre[0]).toBeCloseTo(8, 4);
      expect(centre[1]).toBeCloseTo(22, 4);
    });
  }

  it("maps ISO alpha-2 to the numeric ids used by world-atlas", () => {
    expect(alpha2ToNumeric("PK")).toBe("586");
    expect(alpha2ToNumeric("gb")).toBe("826");
    expect(numericToAlpha2("840")).toBe("US");
    expect(numericToAlpha2(36)).toBe("AU");
  });
});

describe("clustering", () => {
  const pt = (id: string, x: number, y: number, weight = 1) => ({ x, y, weight, item: id });

  it("merges crosses closer than 26 px and keeps far ones apart", () => {
    const out = clusterPoints([pt("a", 100, 100, 5), pt("b", 115, 110), pt("c", 300, 300), pt("d", 100, 127)]);
    expect(out).toHaveLength(3);
    const lead = out.find((c) => c.members.includes("a"))!;
    expect(lead.members.sort()).toEqual(["a", "b"]);
    expect(lead.weight).toBe(6);
    // "d" is 27 px from the leader: its own cross.
    expect(out.find((c) => c.members.includes("d"))!.members).toEqual(["d"]);
  });

  it("the heaviest point leads and holds the cross position", () => {
    const out = clusterPoints([pt("small", 10, 10, 1), pt("big", 20, 10, 50)]);
    expect(out).toHaveLength(1);
    expect(out[0].members[0]).toBe("big");
    expect([out[0].x, out[0].y]).toEqual([20, 10]);
  });

  it("is order-independent for equal input", () => {
    const pts = Array.from({ length: 60 }, (_, i) => pt(`p${i}`, (i * 37) % 400, (i * 91) % 300, (i % 7) + 1));
    const a = clusterPoints(pts).map((c) => c.members.slice().sort().join(",")).sort();
    const b = clusterPoints([...pts].reverse()).map((c) => c.members.slice().sort().join(",")).sort();
    expect(a).toEqual(b);
    expect(clusterPoints(pts).reduce((n, c) => n + c.members.length, 0)).toBe(60);
  });

  it("splits as you zoom in (screen distances scale with k)", () => {
    const base = [
      [0, 0],
      [10, 4],
      [18, -6],
      [60, 0],
    ] as const;
    const at = (k: number) => clusterPoints(base.map(([x, y], i) => pt(`p${i}`, x * k, y * k))).length;
    expect(at(1)).toBe(2);
    expect(at(2)).toBe(3);
    expect(at(4)).toBe(4);
  });

  it("zoomToSeparate finds the zoom where the closest pair separates", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 40, y: 0 },
    ];
    const k = zoomToSeparate(points, 2);
    expect(k).toBeCloseTo(2 * ((26 * 1.25) / 10), 9);
    expect(clusterPoints(points.map((p, i) => pt(String(i), (p.x * k) / 2, (p.y * k) / 2))).length).toBe(3);
    expect(zoomToSeparate([{ x: 1, y: 1 }, { x: 1, y: 1 }], 3)).toBe(MAX_K);
    expect(zoomToSeparate([{ x: 0, y: 0 }, { x: 0.001, y: 0 }], 3)).toBe(MAX_K);
  });

  it("cross size is 11 px for one visit and grows with visits", () => {
    expect(crossSize(1)).toBe(11);
    expect(crossSize(100)).toBeGreaterThan(crossSize(10));
    expect(crossSize(1e9)).toBeLessThanOrEqual(30);
    expect(crossSize(1, 1.5)).toBeCloseTo(16.5, 9);
  });

  it("builds screen markers from the fixture with clusters at world view", () => {
    const bp = fitBaseProjection("naturalEarth", vp);
    const data = toData();
    const geo = buildMarkers(data, DEFAULT_SETTINGS);
    const world = buildScreenMarkers(geo, (lng, lat) => lngLatToScreen(bp, homeView(bp), vp, lng, lat), vp, { sizeMultiplier: 1, latestId: data.latest!.key });
    expect(world.some((m) => m.members.length > 1)).toBe(true);
    expect(world.filter((m) => m.latest)).toHaveLength(1);
    const deep = buildScreenMarkers(geo, (lng, lat) => lngLatToScreen(bp, { ...homeView(bp), k: 40 }, vp, lng, lat), vp, { sizeMultiplier: 1, latestId: null });
    expect(deep.length).toBeLessThan(world.length + 60);
  });
});

function toData() {
  const places = fixture.places.map((p) => ({ ...p, lastSeen: new Date(Date.now() - p.minutesAgo * 60000).toISOString() }));
  const countries = [...new Set(places.map((p) => p.countryCode))].map((cc) => {
    const ps = places.filter((p) => p.countryCode === cc);
    return { countryCode: cc, country: ps[0].country, visits: ps.reduce((s, p) => s + p.visits, 0), uniqueVisitors: ps.reduce((s, p) => s + p.uniqueVisitors, 0), lastSeen: ps[0].lastSeen, online: ps.some((p) => p.online) };
  });
  const l = places[0];
  return { places, countries, latest: { key: l.key, lat: l.lat, lng: l.lng, city: l.city, countryCode: l.countryCode, at: l.lastSeen } };
}

describe("markers and settings", () => {
  it("modes: places, countries (one per country) and top 10 with ranks", () => {
    const data = toData();
    expect(buildMarkers(data, DEFAULT_SETTINGS)).toHaveLength(data.places.length);
    const countries = buildMarkers(data, { ...DEFAULT_SETTINGS, mode: "countries" });
    expect(countries).toHaveLength(data.countries.length);
    expect(countries.every((m) => m.kind === "country" && m.id.startsWith("country:"))).toBe(true);
    const top = buildMarkers(data, { ...DEFAULT_SETTINGS, mode: "top10" });
    expect(top.map((m) => m.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(top[0].label).toBe("Lahore");
  });

  it("max markers never drops online places or the latest visit", () => {
    const data = toData();
    const out = buildMarkers(data, { ...DEFAULT_SETTINGS, maxMarkers: 25 });
    const online = data.places.filter((p) => p.online).map((p) => p.key);
    for (const k of online) expect(out.some((m) => m.id === k)).toBe(true);
    expect(out.length).toBeGreaterThanOrEqual(25);
    expect(out.length).toBeLessThan(data.places.length);
  });

  it("filter values: country code, or code:city", () => {
    const m = { countryCode: "GB", city: "London", kind: "place" } as GeoMarker;
    expect(filterValue(m)).toBe("GB:London");
    expect(filterValue({ ...m, kind: "country" })).toBe("GB");
    expect(filterValue({ ...m, city: null })).toBe("GB");
  });

  it("sanitises stored settings", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    const s = sanitizeSettings({ style: "light", crossSize: 99, pollSeconds: "x", projection: "nope", mode: "top10" });
    expect(s.style).toBe("light");
    expect(s.crossSize).toBe(1.75);
    expect(s.pollSeconds).toBe(20);
    expect(s.projection).toBe("naturalEarth");
    expect(s.mode).toBe("top10");
  });
});
