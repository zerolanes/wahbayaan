"use client";

/**
 * Procedural 3D heritage objects. Every object is centred on the origin and
 * sized in metres from the listing's real dimensions (or a sensible default),
 * so the product viewer shows true scale.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { rng } from "@/lib/art/svg";
import { useSurface, type ArtKind3d } from "./textures";

export type Dims = { w: number; h: number; d: number }; // metres

export const DEFAULT_DIMS: Record<ArtKind3d, Dims> = {
  rug: { w: 1.52, h: 2.44, d: 0.012 },
  calligraphy: { w: 0.6, h: 0.75, d: 0.04 },
  pottery: { w: 0.3, h: 0.42, d: 0.3 },
  truckart: { w: 0.61, h: 0.76, d: 0.03 },
  stone: { w: 0.36, h: 0.52, d: 0.08 },
  salt: { w: 0.2, h: 0.3, d: 0.2 },
  wood: { w: 0.6, h: 1.0, d: 0.05 },
  print: { w: 0.42, h: 0.59, d: 0.02 },
  ajrak: { w: 1.1, h: 1.6, d: 0.004 },
  tile: { w: 0.4, h: 0.4, d: 0.03 },
};

export type HeritageProps = { kind: ArtKind3d; seed: number; dims?: Partial<Dims>; animate?: boolean; lowDetail?: boolean };

/** Resolve dims: fill gaps from defaults and clamp absurd values. */
export function resolveDims(kind: ArtKind3d, dims?: Partial<Dims>): Dims {
  const def = DEFAULT_DIMS[kind];
  const pick = (v: number | undefined, fallback: number) => (v && v > 0.001 && v < 20 ? v : fallback);
  return { w: pick(dims?.w, def.w), h: pick(dims?.h, def.h), d: pick(dims?.d, def.d) };
}

// ── Materials ───────────────────────────────────────────────────────────────

function useGoldLeaf() {
  return useMemo(() => new THREE.MeshStandardMaterial({ color: "#d4ac5a", metalness: 1, roughness: 0.26, envMapIntensity: 1.3 }), []);
}

function useWoodMaterial(seed: number, repeat = 2) {
  const map = useSurface("wood", seed, { repeat: [repeat, repeat] });
  return useMemo(() => new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0 }), [map]);
}

// ── Rug: a hand-knotted rug that ripples like it is floating ────────────────

function Rug({ seed, dims, animate, lowDetail }: { seed: number; dims: Dims; animate?: boolean; lowDetail?: boolean }) {
  const map = useSurface("rug", seed);
  const mesh = useRef<THREE.Mesh>(null);
  const segX = lowDetail ? 24 : 48;
  const segY = lowDetail ? 36 : 72;
  const geo = useMemo(() => new THREE.PlaneGeometry(dims.w, dims.h, segX, segY), [dims.w, dims.h, segX, segY]);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  const phase = useMemo(() => rng(seed)() * Math.PI * 2, [seed]);

  useFrame(({ clock }) => {
    if (!animate || !mesh.current) return;
    const t = clock.elapsedTime * 0.9 + phase;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const amp = Math.min(dims.w, dims.h) * 0.045;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const along = y / dims.h + 0.5; // 0 → 1 along the length
      const taper = Math.sin(along * Math.PI); // ends stay level so the fringe lines up
      const z = (Math.sin(y * 3.1 + t) * 0.7 + Math.sin(x * 4.3 + t * 1.3) * 0.3) * amp * (0.35 + 0.65 * taper);
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });

  const fringe = useMemo(() => {
    const count = Math.max(24, Math.round(dims.w / 0.012));
    return { count, len: Math.min(0.09, dims.h * 0.05) };
  }, [dims.w, dims.h]);

  return (
    <group>
      <mesh ref={mesh} geometry={geo} castShadow receiveShadow>
        <meshPhysicalMaterial map={map} roughness={0.92} sheen={1} sheenRoughness={0.7} sheenColor="#fff0d6" side={THREE.DoubleSide} />
      </mesh>
      <instancedMesh
        ref={(m) => {
          if (!m) return;
          const dummy = new THREE.Object3D();
          let i = 0;
          for (const end of [-1, 1]) {
            for (let k = 0; k < fringe.count; k++) {
              const x = -dims.w / 2 + ((k + 0.5) / fringe.count) * dims.w;
              dummy.position.set(x, end * (dims.h / 2 + fringe.len / 2), 0);
              dummy.rotation.set(0, 0, (Math.sin(k * 12.9898) * 0.5) * 0.12);
              dummy.updateMatrix();
              m.setMatrixAt(i++, dummy.matrix);
            }
          }
          m.instanceMatrix.needsUpdate = true;
        }}
        args={[undefined, undefined, fringe.count * 2]}
        castShadow
      >
        <boxGeometry args={[0.0035, fringe.len, 0.0035]} />
        <meshStandardMaterial color="#efe4cc" roughness={1} />
      </instancedMesh>
    </group>
  );
}

// ── Framed flat work: calligraphy, truck-art panel, print ───────────────────

function frameGeometry(w: number, h: number, border: number, depth: number, bevel = true) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - border, -h / 2 - border);
  shape.lineTo(w / 2 + border, -h / 2 - border);
  shape.lineTo(w / 2 + border, h / 2 + border);
  shape.lineTo(-w / 2 - border, h / 2 + border);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2, -h / 2);
  hole.lineTo(-w / 2, h / 2);
  hole.lineTo(w / 2, h / 2);
  hole.lineTo(w / 2, -h / 2);
  hole.closePath();
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel,
    bevelThickness: border * 0.35,
    bevelSize: border * 0.25,
    bevelSegments: 3,
    curveSegments: 4,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

function CalligraphyFrame({ seed, dims }: { seed: number; dims: Dims }) {
  const map = useSurface("calligraphy", seed);
  const gold = useGoldLeaf();
  const border = Math.min(dims.w, dims.h) * 0.07;
  const w = dims.w - border * 2;
  const h = dims.h - border * 2;
  const depth = Math.max(0.025, dims.d);
  const frame = useMemo(() => frameGeometry(w, h, border, depth), [w, h, border, depth]);
  return (
    <group>
      <mesh geometry={frame} material={gold} castShadow receiveShadow />
      <mesh position={[0, 0, -depth * 0.2]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Museum glass */}
      <mesh position={[0, 0, depth * 0.3]}>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial transparent opacity={0.08} roughness={0.04} metalness={0} clearcoat={1} clearcoatRoughness={0.02} color="#ffffff" />
      </mesh>
      <mesh position={[0, 0, -depth / 2 - 0.002]}>
        <boxGeometry args={[w + border * 2, h + border * 2, 0.004]} />
        <meshStandardMaterial color="#2a1d12" roughness={0.9} />
      </mesh>
    </group>
  );
}

function PaintedPanel({ seed, dims }: { seed: number; dims: Dims }) {
  const map = useSurface("truckart", seed);
  const wood = useWoodMaterial(seed + 7, 1);
  const depth = Math.max(0.02, dims.d);
  const materials = useMemo(() => {
    const face = new THREE.MeshPhysicalMaterial({ map, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15 }); // enamel varnish
    return [wood, wood, wood, wood, face, wood];
  }, [map, wood]);
  return (
    <mesh material={materials} castShadow receiveShadow>
      <boxGeometry args={[dims.w, dims.h, depth]} />
    </mesh>
  );
}

function FramedPrint({ seed, dims }: { seed: number; dims: Dims }) {
  const map = useSurface("print", seed);
  const border = Math.min(dims.w, dims.h) * 0.035;
  const depth = 0.022;
  const w = dims.w;
  const h = dims.h;
  const frame = useMemo(() => frameGeometry(w, h, border, depth, false), [w, h, border]);
  const frameColor = useMemo(() => (seed % 2 ? "#1d1b1a" : "#6b4a2c"), [seed]);
  return (
    <group>
      <mesh geometry={frame} castShadow receiveShadow>
        <meshStandardMaterial color={frameColor} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, -0.004]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, depth * 0.35]}>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial transparent opacity={0.06} roughness={0.05} clearcoat={1} />
      </mesh>
    </group>
  );
}

// ── Cloth (ajrak) hanging from a rod ────────────────────────────────────────

function Cloth({ seed, dims, animate, lowDetail }: { seed: number; dims: Dims; animate?: boolean; lowDetail?: boolean }) {
  const map = useSurface("ajrak", seed);
  const geo = useMemo(() => new THREE.PlaneGeometry(dims.w, dims.h, lowDetail ? 20 : 40, lowDetail ? 28 : 56), [dims.w, dims.h, lowDetail]);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  useFrame(({ clock }) => {
    const t = animate ? clock.elapsedTime : 0;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const hang = (dims.h / 2 - y) / dims.h; // 0 at the rod, 1 at the hem
      const z = Math.sin(x * 9 + t * 1.2) * 0.018 * hang + Math.sin(y * 4 + t * 0.8) * 0.02 * hang + Math.cos(x * 22) * 0.004;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshPhysicalMaterial map={map} roughness={0.95} sheen={0.6} sheenColor="#ffd9c0" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, dims.h / 2 + 0.012, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, dims.w + 0.12, 16]} />
        <meshStandardMaterial color="#b8893b" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ── Kashi tiles ─────────────────────────────────────────────────────────────

function TilePanel({ seed, dims }: { seed: number; dims: Dims }) {
  const map = useSurface("tile", seed);
  const wood = useWoodMaterial(seed, 1);
  const n = 2;
  const gap = 0.006;
  const tw = (dims.w - gap * (n + 1)) / n;
  const th = (dims.h - gap * (n + 1)) / n;
  const tiles = useMemo(() => {
    const out: { x: number; y: number; tex: THREE.Texture }[] = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const t = map.clone();
        t.repeat.set(1 / n, 1 / n);
        t.offset.set(i / n, j / n);
        t.needsUpdate = true;
        out.push({ x: -dims.w / 2 + gap + tw / 2 + i * (tw + gap), y: -dims.h / 2 + gap + th / 2 + j * (th + gap), tex: t });
      }
    return out;
  }, [map, dims.w, dims.h, tw, th]);
  return (
    <group>
      <mesh material={wood} position={[0, 0, -0.012]} castShadow receiveShadow>
        <boxGeometry args={[dims.w + 0.02, dims.h + 0.02, 0.018]} />
      </mesh>
      {tiles.map((t, i) => (
        <mesh key={i} position={[t.x, t.y, 0.004]} castShadow receiveShadow>
          <boxGeometry args={[tw, th, 0.012]} />
          <meshPhysicalMaterial map={t.tex} roughness={0.2} clearcoat={1} clearcoatRoughness={0.08} />
        </mesh>
      ))}
    </group>
  );
}

// ── Multani blue pottery ────────────────────────────────────────────────────

function vesselProfile(kind: "vase" | "bowl", w: number, h: number): THREE.Vector2[] {
  const r = w / 2;
  if (kind === "bowl") {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const a = (t * Math.PI) / 2;
      pts.push(new THREE.Vector2(r * 0.35 + (r - r * 0.35) * Math.sin(a), h * (1 - Math.cos(a))));
    }
    return pts;
  }
  // Vase: foot → belly → shoulder → narrow neck → flared lip, via a smooth spline.
  const ctrl = [
    [0.36, 0],
    [0.42, 0.04],
    [0.85, 0.28],
    [1.0, 0.45],
    [0.8, 0.66],
    [0.36, 0.8],
    [0.28, 0.9],
    [0.34, 1.0],
  ];
  const curve = new THREE.SplineCurve(ctrl.map(([x, y]) => new THREE.Vector2(x * r, y * h)));
  return curve.getPoints(48);
}

function Vessel({ seed, dims, kind }: { seed: number; dims: Dims; kind: "vase" | "bowl" }) {
  const map = useSurface("pottery", seed, { wrap: true });
  const { outer, inner, lip } = useMemo(() => {
    const prof = vesselProfile(kind, dims.w, dims.h);
    const outer = new THREE.LatheGeometry(prof, 96);
    const thickness = Math.min(dims.w, dims.h) * 0.035;
    const innerProf = prof.map((p) => new THREE.Vector2(Math.max(0.001, p.x - thickness), p.y + (kind === "bowl" ? thickness : 0))).filter((p) => p.y > thickness * 1.5);
    const inner = new THREE.LatheGeometry(innerProf, 64);
    const top = prof[prof.length - 1];
    const lip = new THREE.TorusGeometry(top.x - thickness / 2, thickness / 2, 12, 96);
    lip.rotateX(Math.PI / 2);
    lip.translate(0, top.y, 0);
    for (const g of [outer, inner, lip]) g.translate(0, -dims.h / 2, 0);
    return { outer, inner, lip };
  }, [dims.w, dims.h, kind]);
  const glaze = useMemo(() => new THREE.MeshPhysicalMaterial({ map, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 }), [map]);
  return (
    <group>
      <mesh geometry={outer} material={glaze} castShadow receiveShadow />
      <mesh geometry={inner} receiveShadow>
        <meshPhysicalMaterial color={kind === "bowl" ? "#f4f1e8" : "#1d2340"} roughness={0.3} clearcoat={1} side={THREE.BackSide} />
      </mesh>
      <mesh geometry={lip} castShadow>
        <meshPhysicalMaterial color="#2f5ea8" roughness={0.25} clearcoat={1} />
      </mesh>
    </group>
  );
}

function Plate({ seed, dims }: { seed: number; dims: Dims }) {
  const map = useSurface("pottery", seed);
  const geo = useMemo(() => {
    const R = dims.w / 2;
    const t = Math.max(0.012, dims.d * 0.3);
    const prof = [
      [0, 0],
      [R * 0.55, 0],
      [R * 0.62, t * 0.6],
      [R * 0.95, t * 1.6],
      [R, t * 2.2],
      [R * 0.97, t * 2.35],
      [R * 0.62, t * 1.05],
      [0, t * 1.05],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(prof, 128);
    // Planar top-down UVs so the plate design reads from above.
    const pos = g.attributes.position;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * R) + 0.5, -pos.getZ(i) / (2 * R) + 0.5);
    uv.needsUpdate = true;
    g.computeVertexNormals();
    g.rotateX(Math.PI / 2); // face the viewer like a hung charger
    g.translate(0, 0, -t);
    return g;
  }, [dims.w, dims.d]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshPhysicalMaterial map={map} roughness={0.2} clearcoat={1} clearcoatRoughness={0.05} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Himalayan salt lamp ─────────────────────────────────────────────────────

function SaltLamp({ seed, dims, animate }: { seed: number; dims: Dims; animate?: boolean }) {
  const crystalH = dims.h * 0.82;
  const baseH = dims.h - crystalH;
  const geo = useMemo(() => {
    const r = rng(seed);
    const g = new THREE.IcosahedronGeometry(0.5, 3);
    const waves = Array.from({ length: 6 }, () => ({ k: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(2 + r() * 5), p: r() * 6.28, a: 0.03 + r() * 0.07 }));
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    // Displace per unique position so shared vertices stay welded.
    const cache = new Map<string, number>();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
      let s = cache.get(key);
      if (s == null) {
        s = 1 + waves.reduce((acc, w) => acc + Math.sin(v.dot(w.k) + w.p) * w.a, 0);
        cache.set(key, s);
      }
      v.multiplyScalar(s);
      pos.setXYZ(i, v.x * dims.w, v.y * crystalH * 1.05 + crystalH * 0.02, v.z * dims.d);
    }
    g.computeVertexNormals();
    g.translate(0, -dims.h / 2 + baseH + crystalH / 2, 0);
    return g;
  }, [seed, dims.w, dims.d, crystalH, baseH, dims.h]);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const flicker = animate ? 0.92 + Math.sin(clock.elapsedTime * 2.1) * 0.04 + Math.sin(clock.elapsedTime * 5.3) * 0.02 : 1;
    if (mat.current) mat.current.emissiveIntensity = 0.55 * flicker;
    if (light.current) light.current.intensity = 1.2 * flicker;
  });
  return (
    <group>
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial ref={mat} color="#e98a62" emissive="#ff5a1f" emissiveIntensity={0.55} roughness={0.42} flatShading clearcoat={0.35} transmission={0.15} thickness={0.2} attenuationColor="#ff7a45" />
      </mesh>
      <pointLight ref={light} color="#ff9a5c" intensity={1.6} distance={dims.h * 8} decay={2} position={[0, -dims.h / 2 + baseH + crystalH * 0.45, 0]} />
      <mesh position={[0, -dims.h / 2 + baseH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[dims.w * 0.42, dims.w * 0.48, baseH, 32]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.55} />
      </mesh>
    </group>
  );
}

// ── Gandhara stone relief: a niche cut into schist, with a stupa inside ─────

function StoneRelief({ seed, dims }: { seed: number; dims: Dims }) {
  const map = useSurface("stone", seed, { repeat: [1.5, 1.5] });
  const stoneMat = useMemo(() => new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 1.2, roughness: 0.9, metalness: 0 }), [map]);
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ map, color: "#6f746c", roughness: 0.95 }), [map]);
  const { w, h } = dims;
  const depth = Math.max(0.05, dims.d);
  const nw = w * 0.56;
  const archTop = h * 0.3;
  const nicheBottom = -h * 0.4;
  const front = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, -h / 2);
    s.lineTo(w / 2, -h / 2);
    s.lineTo(w / 2, h / 2);
    s.lineTo(-w / 2, h / 2);
    s.closePath();
    const niche = new THREE.Path();
    niche.moveTo(-nw / 2, nicheBottom);
    niche.lineTo(nw / 2, nicheBottom);
    niche.lineTo(nw / 2, archTop - nw / 2);
    niche.absarc(0, archTop - nw / 2, nw / 2, 0, Math.PI, false);
    niche.lineTo(-nw / 2, nicheBottom);
    s.holes.push(niche);
    const g = new THREE.ExtrudeGeometry(s, { depth: depth * 0.55, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 32 });
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w, uv.getY(i) / h);
    g.translate(0, 0, -depth * 0.05);
    return g;
  }, [w, h, nw, archTop, nicheBottom, depth]);
  const stupa = useMemo(() => {
    const s = nw * 0.62; // stupa footprint
    const prof = [
      [0, 0],
      [s * 0.5, 0],
      [s * 0.5, s * 0.12],
      [s * 0.42, s * 0.12],
      [s * 0.42, s * 0.24],
      [s * 0.36, s * 0.24],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * (Math.PI / 2);
      prof.push(new THREE.Vector2(s * 0.36 * Math.cos(a), s * 0.24 + s * 0.36 * Math.sin(a)));
    }
    const g = new THREE.LatheGeometry(prof, 48);
    return { g, s };
  }, [nw]);
  const pilasterH = archTop - nw / 2 - nicheBottom;
  return (
    <group>
      <mesh geometry={front} material={stoneMat} castShadow receiveShadow />
      {/* Back of the niche */}
      <mesh position={[0, 0, -depth * 0.45]} material={darkMat} receiveShadow>
        <boxGeometry args={[w * 0.98, h * 0.98, depth * 0.1]} />
      </mesh>
      {/* Stupa: drums, dome, harmika and three umbrellas */}
      <group position={[0, nicheBottom, -depth * 0.25]}>
        <mesh geometry={stupa.g} material={stoneMat} castShadow receiveShadow />
        <mesh position={[0, stupa.s * 0.62, 0]} material={stoneMat} castShadow>
          <boxGeometry args={[stupa.s * 0.16, stupa.s * 0.08, stupa.s * 0.16]} />
        </mesh>
        <mesh position={[0, stupa.s * 0.8, 0]} material={stoneMat}>
          <cylinderGeometry args={[0.004, 0.004, stupa.s * 0.34, 8]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, stupa.s * (0.7 + i * 0.09), 0]} material={stoneMat} castShadow>
            <cylinderGeometry args={[stupa.s * (0.16 - i * 0.035), stupa.s * (0.16 - i * 0.035), 0.006, 24]} />
          </mesh>
        ))}
      </group>
      {/* Pilasters with capitals */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (w * 0.4), nicheBottom + pilasterH / 2, depth * 0.52]}>
          <mesh material={stoneMat} castShadow>
            <boxGeometry args={[w * 0.07, pilasterH, depth * 0.12]} />
          </mesh>
          <mesh position={[0, pilasterH / 2 + w * 0.02, 0]} material={stoneMat} castShadow>
            <boxGeometry args={[w * 0.11, w * 0.04, depth * 0.16]} />
          </mesh>
        </group>
      ))}
      {/* Dentil frieze */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-w / 2 + (i + 0.5) * (w / 9), h / 2 - h * 0.07, depth * 0.52]} material={stoneMat} castShadow>
          <boxGeometry args={[w / 20, h * 0.035, depth * 0.1]} />
        </mesh>
      ))}
    </group>
  );
}

// ── Chiniot jharokha: an arched panel with a pierced jali ───────────────────

/** Petal rosette outline (used for jali piercings instead of stars). */
function starPath(cx: number, cy: number, outer: number, inner: number, points = 8, rot = 0) {
  const p = new THREE.Path();
  const steps = points * 10;
  for (let i = 0; i <= steps; i++) {
    const a = rot + (2 * Math.PI * i) / steps;
    const r = inner + (outer - inner) * Math.pow(Math.abs(Math.cos((points * (a - rot)) / 2)), 0.9);
    const x = cx + r * Math.sin(a);
    const y = cy + r * Math.cos(a);
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  return p;
}

function Jharokha({ seed, dims, lowDetail }: { seed: number; dims: Dims; lowDetail?: boolean }) {
  const wood = useWoodMaterial(seed, 2);
  const { w, h } = dims;
  const depth = Math.max(0.035, dims.d);
  const geo = useMemo(() => {
    const r = w / 2;
    const s = new THREE.Shape();
    s.moveTo(-r, -h / 2);
    s.lineTo(r, -h / 2);
    s.lineTo(r, h / 2 - r);
    s.absarc(0, h / 2 - r, r, 0, Math.PI, false);
    s.lineTo(-r, -h / 2);
    // Jali: a grid of pierced rosettes in the lower panel
    const inset = w * 0.12;
    const cols = 4;
    const cell = (w - inset * 2) / cols;
    const rows = Math.floor((h - r - inset * 1.2) / cell);
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const cx = -w / 2 + inset + cell * (i + 0.5);
        const cy = -h / 2 + inset + cell * (j + 0.5);
        s.holes.push(starPath(cx, cy, cell * 0.4, cell * 0.2, 8, Math.PI / 8));
      }
    // Rosette in the arch
    s.holes.push(starPath(0, h / 2 - r * 0.95, r * 0.34, r * 0.16, 12));
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: lowDetail ? 1 : 3, curveSegments: lowDetail ? 12 : 32 });
    g.translate(0, 0, -depth / 2);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w, uv.getY(i) / w);
    return g;
  }, [w, h, depth, lowDetail]);
  const frame = useMemo(() => {
    const r = w / 2;
    const t = w * 0.05;
    const s = new THREE.Shape();
    s.moveTo(-r - t, -h / 2 - t);
    s.lineTo(r + t, -h / 2 - t);
    s.lineTo(r + t, h / 2 - r);
    s.absarc(0, h / 2 - r, r + t, 0, Math.PI, false);
    s.lineTo(-r - t, -h / 2 - t);
    const hole = new THREE.Path();
    hole.moveTo(-r, -h / 2);
    hole.lineTo(-r, h / 2 - r);
    hole.absarc(0, h / 2 - r, r, Math.PI, 0, true);
    hole.lineTo(r, -h / 2);
    hole.lineTo(-r, -h / 2);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: depth * 1.5, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 32 });
    g.translate(0, 0, -depth * 0.75);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w, uv.getY(i) / w);
    return g;
  }, [w, h, depth]);
  return (
    <group>
      <mesh geometry={geo} material={wood} castShadow receiveShadow />
      <mesh geometry={frame} material={wood} castShadow receiveShadow />
    </group>
  );
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export function HeritageObject({ kind, seed, dims, animate = true, lowDetail }: HeritageProps) {
  const d = resolveDims(kind, dims);
  switch (kind) {
    case "rug":
      return <Rug seed={seed} dims={d} animate={animate} lowDetail={lowDetail} />;
    case "calligraphy":
      return <CalligraphyFrame seed={seed} dims={d} />;
    case "truckart":
      return <PaintedPanel seed={seed} dims={d} />;
    case "print":
      return <FramedPrint seed={seed} dims={d} />;
    case "ajrak":
      return <Cloth seed={seed} dims={d} animate={animate} lowDetail={lowDetail} />;
    case "tile":
      return <TilePanel seed={seed} dims={d} />;
    case "pottery":
      return seed % 3 === 1 ? <Plate seed={seed} dims={d} /> : <Vessel seed={seed} dims={d} kind={seed % 3 === 2 ? "bowl" : "vase"} />;
    case "salt":
      return <SaltLamp seed={seed} dims={d} animate={animate} />;
    case "stone":
      return <StoneRelief seed={seed} dims={d} />;
    case "wood":
      return <Jharokha seed={seed} dims={d} lowDetail={lowDetail} />;
  }
}

export const HERITAGE_KINDS: ArtKind3d[] = ["rug", "calligraphy", "pottery", "truckart", "stone", "salt", "wood", "print", "ajrak", "tile"];

export function isHeritageKind(kind: string): kind is ArtKind3d {
  return (HERITAGE_KINDS as string[]).includes(kind);
}
