"use client";

import { Bounds, ContactShadows, Html, OrbitControls, useBounds, useGLTF, useProgress } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Box, Move3d, Pause, Play, RotateCcw, Ruler } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { HeritageObject, isHeritageKind, resolveDims, type Dims } from "./heritage/objects";
import { StudioEnvironment } from "./heritage/studio";
import type { ProductViewerProps } from "./product-viewer";

function ScanModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => {
    cloned.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, [cloned]);
  return <primitive object={cloned} />;
}

/** A flat silhouette 170 cm tall for sense of scale. */
function ScaleFigure({ x }: { x: number }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    // Simple standing figure outline (metres), feet at y=0.
    s.moveTo(-0.12, 0);
    s.lineTo(-0.1, 0.82);
    s.lineTo(-0.22, 0.86);
    s.lineTo(-0.25, 1.38);
    s.quadraticCurveTo(-0.2, 1.45, -0.09, 1.46);
    s.lineTo(-0.07, 1.5);
    s.quadraticCurveTo(-0.11, 1.7, 0, 1.7);
    s.quadraticCurveTo(0.11, 1.7, 0.07, 1.5);
    s.lineTo(0.09, 1.46);
    s.quadraticCurveTo(0.2, 1.45, 0.25, 1.38);
    s.lineTo(0.22, 0.86);
    s.lineTo(0.1, 0.82);
    s.lineTo(0.12, 0);
    s.lineTo(0.02, 0);
    s.lineTo(0, 0.78);
    s.lineTo(-0.02, 0);
    s.closePath();
    return s;
  }, []);
  return (
    <group position={[x, 0, -0.1]}>
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color="#c3aa82" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, 1.78, 0]} center className="pointer-events-none">
        <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] whitespace-nowrap text-white/90">170 cm</span>
      </Html>
    </group>
  );
}

function FitOnChange({ token }: { token: string }) {
  const bounds = useBounds();
  useEffect(() => {
    bounds.refresh().clip().fit();
  }, [token, bounds]);
  return null;
}

function Floor({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <ContactShadows opacity={0.55} scale={8} blur={2.4} far={3} resolution={512} color="#1a1208" />
      <gridHelper args={[10, 100, "#c3aa82", "#c3aa82"]} position={[0, 0.0005, 0]}>
        <meshBasicMaterial attach="material" transparent opacity={0.08} />
      </gridHelper>
    </group>
  );
}

function LoadingVeil() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <span className="rounded-full bg-black/40 px-3 py-1.5 text-xs text-white/80 backdrop-blur">Loading 3D view… {Math.round(progress)}%</span>
    </div>
  );
}

export function ProductViewerCanvas({ model, dims, title, className }: ProductViewerProps) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [showScale, setShowScale] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  const kind = model.source === "procedural" && isHeritageKind(model.kind) ? model.kind : null;
  const d: Dims | null = kind
    ? resolveDims(kind, {
        w: dims.widthCm ? dims.widthCm / 100 : undefined,
        h: dims.heightCm ? dims.heightCm / 100 : undefined,
        d: dims.depthCm ? dims.depthCm / 100 : undefined,
      })
    : null;

  // Rugs are shown lying on the floor; everything else stands.
  const lying = kind === "rug";
  const height = d ? (lying ? d.d + 0.05 : d.h) : 1;
  const floorY = 0;
  const label = d ? `${Math.round(d.w * 100)} × ${Math.round(d.h * 100)}${d.d >= 0.01 ? ` × ${Math.round(d.d * 100)}` : ""} cm` : null;
  const figureX = d ? Math.max(d.w, lying ? d.w : 0) / 2 + 0.45 : 1;

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#2a3564_0%,#141a33_55%,#0b0e1c_100%)]", className)}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0.6, 0.7, 2.4], fov: 32, near: 0.01, far: 100 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <StudioEnvironment />
        <ambientLight intensity={0.25} />
        <directionalLight position={[2.5, 4, 3]} intensity={1.6} color="#ffe2bd" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={lying ? 1.1 : 1.35} maxDuration={0.8}>
            <FitOnChange token={`${resetToken}-${showScale}`} />
            <group position={[0, floorY + height / 2, 0]} rotation={lying ? [-Math.PI / 2 + 0.02, 0, 0.35] : [0, 0, 0]}>
              {kind && d ? <HeritageObject kind={kind} seed={(model as { seed: number }).seed} dims={d} animate={false} /> : null}
              {model.source === "scan" ? <ScanModel url={model.url} /> : null}
            </group>
            {showScale ? <ScaleFigure x={figureX} /> : null}
          </Bounds>
        </Suspense>
        <Floor y={floorY} />
        <OrbitControls makeDefault autoRotate={autoRotate} autoRotateSpeed={0.8} enablePan={false} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2 - 0.02} />
      </Canvas>

      <LoadingVeil />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
          <Box className="size-3.5" aria-hidden />
          {model.source === "scan" ? "3D scan of this piece" : "Illustrative 3D preview — not a scan of this piece"}
        </span>
        {label ? <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white/90 backdrop-blur tabular-nums">{label}</span> : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
        <span className="hidden items-center gap-1.5 text-[11px] text-white/60 sm:flex">
          <Move3d className="size-3.5" aria-hidden /> Drag to rotate · scroll or pinch to zoom
        </span>
        <div className="ml-auto flex gap-1.5">
          <button type="button" onClick={() => setAutoRotate((v) => !v)} className="grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60" aria-label={autoRotate ? "Pause rotation" : "Rotate"}>
            {autoRotate ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => setShowScale((v) => !v)}
            aria-pressed={showScale}
            className={cn("flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium backdrop-blur transition", showScale ? "bg-gold-400 text-ink" : "bg-black/40 text-white hover:bg-black/60")}
          >
            <Ruler className="size-4" /> Scale
          </button>
          <button type="button" onClick={() => setResetToken((n) => n + 1)} className="grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60" aria-label={`Reset view of ${title}`}>
            <RotateCcw className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
