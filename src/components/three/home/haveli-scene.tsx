"use client";

import { Float, useCursor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { HeritageObject, resolveDims } from "../heritage/objects";
import { StudioEnvironment } from "../heritage/studio";
import type { ArtKind3d } from "../heritage/textures";
import { COURT, Haveli } from "./architecture";
import { scrollState } from "./scroll-store";

export type Chapter = { slug: string; name: string; tagline: string | null; count: number; kind: ArtKind3d; seed: number };

const ITEM_Y = 1.95;

export function chapterAnchor(i: number) {
  const side = i % 2 === 0 ? 1 : -1;
  return new THREE.Vector3(side * 2.9, ITEM_Y, COURT.start - 9 - i * 4.9);
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

type Stop = { pos: THREE.Vector3; target: THREE.Vector3 };

function useStops(n: number): Stop[] {
  return useMemo(() => {
    const stops: Stop[] = [{ pos: new THREE.Vector3(0, 4.6, COURT.start + 7), target: new THREE.Vector3(0, 2.4, -14) }];
    for (let i = 0; i < n; i++) {
      const a = chapterAnchor(i);
      stops.push({ pos: new THREE.Vector3(a.x * 0.12, 2.15, a.z + 3.55), target: new THREE.Vector3(a.x * 0.8, ITEM_Y + 0.05, a.z) });
    }
    stops.push({ pos: new THREE.Vector3(0, 3.1, COURT.end + 13), target: new THREE.Vector3(0, 6.6, COURT.end) });
    return stops;
  }, [n]);
}

function CameraRig({ n, reducedMotion, onActive }: { n: number; reducedMotion: boolean; onActive: (i: number) => void }) {
  const stops = useStops(n);
  const camera = useThree((s) => s.camera);
  const want = useMemo(() => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), look: stops[0].target.clone() }), [stops]);
  const last = useRef(-2);
  useFrame((_, dt) => {
    const p = Math.min(Math.max(scrollState.progress, 0), 1) * (stops.length - 1);
    const i = Math.min(Math.floor(p), stops.length - 2);
    const t = smoothstep(p - i);
    want.pos.lerpVectors(stops[i].pos, stops[i + 1].pos, t);
    want.target.lerpVectors(stops[i].target, stops[i + 1].target, t);
    if (!reducedMotion) {
      want.pos.x += scrollState.pointerX * 0.35;
      want.pos.y += scrollState.pointerY * 0.18;
    }
    const lambda = reducedMotion ? 60 : 3.2;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, want.pos.x, lambda, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, want.pos.y, lambda, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, want.pos.z, lambda, dt);
    want.look.x = THREE.MathUtils.damp(want.look.x, want.target.x, lambda, dt);
    want.look.y = THREE.MathUtils.damp(want.look.y, want.target.y, lambda, dt);
    want.look.z = THREE.MathUtils.damp(want.look.z, want.target.z, lambda, dt);
    camera.lookAt(want.look);
    const active = Math.round(p) - 1;
    if (active !== last.current) {
      last.current = active;
      onActive(active);
    }
  });
  return null;
}

function Plinth() {
  return (
    <group>
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.5, 0.6, 0.52, 8]} />
        <meshStandardMaterial color="#efe6d6" roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.535, 0]}>
        <cylinderGeometry args={[0.56, 0.56, 0.05, 8]} />
        <meshStandardMaterial color="#f6efe2" roughness={0.25} emissive="#3a2a12" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.56, 0]} rotation={[Math.PI / 2, 0, Math.PI / 8]}>
        <torusGeometry args={[0.56, 0.018, 8, 8]} />
        <meshStandardMaterial color="#e0b457" metalness={0.9} roughness={0.25} emissive="#6b4a12" emissiveIntensity={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.85, 1.05, 64]} />
        <meshBasicMaterial color="#e0b457" transparent opacity={0.55} toneMapped={false} />
      </mesh>
    </group>
  );
}

function FloatingPiece({
  chapter,
  index,
  active,
  reducedMotion,
  lowDetail,
  onSelect,
}: {
  chapter: Chapter;
  index: number;
  active: boolean;
  reducedMotion: boolean;
  lowDetail: boolean;
  onSelect: (slug: string) => void;
}) {
  const anchor = chapterAnchor(index);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const dims = resolveDims(chapter.kind);
  const isRug = chapter.kind === "rug" || chapter.kind === "ajrak";
  const maxDim = Math.max(dims.w, dims.h);
  const target = isRug ? 2.3 : chapter.kind === "salt" || chapter.kind === "pottery" ? 1.25 : 1.55;
  const scale = target / maxDim;
  const facing = -Math.sign(anchor.x) * 0.55;
  const spin = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);
  const roundish = chapter.kind === "pottery" || chapter.kind === "salt";
  useFrame((state, dt) => {
    if (spin.current) {
      if (roundish && !reducedMotion) spin.current.rotation.y += dt * 0.25;
      const s = hovered ? 1.07 : 1;
      spin.current.scale.x = THREE.MathUtils.damp(spin.current.scale.x, s, 6, dt);
      spin.current.scale.y = spin.current.scale.z = spin.current.scale.x;
    }
    if (glow.current) glow.current.intensity = THREE.MathUtils.damp(glow.current.intensity, active || hovered ? 14 : 3, 3, dt);
  });
  return (
    <group position={[anchor.x, 0, anchor.z]}>
      <Plinth />
      <pointLight ref={glow} position={[-Math.sign(anchor.x) * 0.9, 3.3, 1.6]} color="#ffd9a3" intensity={3} distance={6} decay={2} />
      <Float enabled={!reducedMotion} speed={1.3} rotationIntensity={isRug ? 0.12 : 0.28} floatIntensity={0.55} floatingRange={[-0.06, 0.18]}>
        <group
          position={[0, ITEM_Y - 0.2, 0]}
          rotation={isRug ? [-Math.PI / 2 + 0.42, 0, facing * 0.6] : [0, facing, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(chapter.slug);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        >
          <group ref={spin}>
            <group scale={scale}>
              <Suspense fallback={null}>
                <HeritageObject kind={chapter.kind} seed={chapter.seed} animate={!reducedMotion} lowDetail={lowDetail} />
              </Suspense>
            </group>
          </group>
        </group>
      </Float>
    </group>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.35} color="#8090c8" />
      <hemisphereLight args={["#6f7fc0", "#3a1c10", 0.55]} />
      <directionalLight position={[-12, 20, 8]} intensity={0.55} color="#b8c6ff" />
    </>
  );
}

export default function HaveliCanvas({
  chapters,
  lowDetail,
  reducedMotion,
  running,
  onSelect,
  onActive,
}: {
  chapters: Chapter[];
  lowDetail: boolean;
  reducedMotion: boolean;
  running: boolean;
  onSelect: (slug: string) => void;
  onActive: (i: number) => void;
}) {
  const [active, setActive] = useState(-1);
  return (
    <Canvas
      frameloop={running ? "always" : "never"}
      dpr={lowDetail ? [1, 1.25] : [1, 1.75]}
      camera={{ position: [0, 4.6, COURT.start + 7], fov: 46, near: 0.1, far: 260 }}
      gl={{ antialias: !lowDetail, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      onCreated={({ scene }) => {
        scene.fog = new THREE.FogExp2("#1a1633", 0.022);
      }}
    >
      <Lights />
      <Suspense fallback={null}>
        <StudioEnvironment intensity={0.55} />
        <Haveli lowDetail={lowDetail} />
      </Suspense>
      {chapters.map((c, i) => (
        <FloatingPiece key={c.slug} chapter={c} index={i} active={i === active} reducedMotion={reducedMotion} lowDetail={lowDetail} onSelect={onSelect} />
      ))}
      <CameraRig
        n={chapters.length}
        reducedMotion={reducedMotion}
        onActive={(i) => {
          setActive(i);
          onActive(i);
        }}
      />
      {!lowDetail ? (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.55} luminanceSmoothing={0.3} />
          <Vignette offset={0.22} darkness={0.72} />
        </EffectComposer>
      ) : (
        <></>
      )}
    </Canvas>
  );
}
