"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer, Text3D } from "@react-three/drei";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Group, Mesh } from "three";
import { wordmarkTypeface } from "./wordmark-typeface";

/**
 * The hero's 3D wordmark: real extruded glyph geometry (Fraunces outlines via
 * drei <Text3D>) in solid deep navy, with a darker ink extrusion for depth —
 * the same look as the static fallback (`.wordmark-static`), only with real
 * depth. No gold, no texture: plain materials stay crisp at any size. Floats
 * and sways gently, leans a little toward the pointer, and rests on a soft
 * contact shadow. Rendered at device pixel ratio (capped at 2.5) with
 * antialiasing, so it is sharp at any zoom.
 */
export default function Wordmark3D({ onReady, running }: { onReady: () => void; running: boolean }) {
  return (
    <Canvas
      dpr={[1, 2.5]}
      // No filmic tone mapping: it washes the navy towards grey. Colours stay as in the static wordmark.
      flat
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 9], fov: 30 }}
      frameloop={running ? "always" : "demand"}
      aria-hidden
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[-4, 5, 6]} intensity={0.85} color="#ffffff" />
      <directionalLight position={[5, -2, 4]} intensity={0.35} color="#eef1f8" />
      <Environment resolution={256} frames={1}>
        {/* Neutral surroundings: soft white highlights on the navy, never a gold or warm cast. */}
        <color attach="background" args={["#e9e9ec"]} />
        <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 4, 4]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={0.7} color="#f2f4fa" position={[-6, 0, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#f2f4fa" position={[6, -1, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      </Environment>
      <Wordmark onReady={onReady} />
    </Canvas>
  );
}

/** Calls `onReady` only once valid geometry exists, so a failure never hides the static wordmark. */
function Wordmark({ onReady }: { onReady: () => void }) {
  const tilt = useRef<Group>(null);
  const fit = useRef<Group>(null);
  const text = useRef<Mesh>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const { viewport, pointer, invalidate } = useThree();
  useEffect(() => invalidate(), [box, invalidate]);
  // Measure the glyph geometry once and centre it (in its own units, so the fit scale can't feed back).
  useLayoutEffect(() => {
    const m = text.current;
    if (!m) return;
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox!;
    m.position.set(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
    const width = b.max.x - b.min.x, height = b.max.y - b.min.y;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0) return;
    setBox({ width, height });
    // Reveal after the first frame with the fitted scale has been drawn.
    requestAnimationFrame(() => requestAnimationFrame(() => onReady()));
  }, [onReady]);

  // Fit the word to ~84% of the canvas width (and never taller than ~62%).
  const scale = box ? Math.min((viewport.width * 0.84) / box.width, (viewport.height * 0.62) / box.height) : 1;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (tilt.current) {
      // Gentle sway, plus a slight lean toward the pointer.
      tilt.current.rotation.y += (Math.sin(t * 0.45) * 0.16 + pointer.x * 0.12 - tilt.current.rotation.y) * 0.06;
      tilt.current.rotation.x += (-pointer.y * 0.08 + 0.04 - tilt.current.rotation.x) * 0.06;
    }
  });

  return (
    <>
      <group ref={tilt}>
        <Float speed={1.1} rotationIntensity={0.18} floatIntensity={0.5} floatingRange={[-0.06, 0.06]}>
          <group ref={fit} scale={scale}>
              <Text3D
                ref={text}
                font={wordmarkTypeface as never}
                size={1}
                height={0.32}
                curveSegments={24}
                bevelEnabled
                bevelThickness={0.06}
                bevelSize={0.028}
                bevelSegments={4}
                letterSpacing={0.01}
              >
                Wahbayaan
                {/* Group 0: front/back faces — solid deep navy (indigo-800/900). */}
                <meshPhysicalMaterial attach="material-0" color="#18224a" roughness={0.45} metalness={0} specularIntensity={0.2} clearcoat={0.15} clearcoatRoughness={0.3} envMapIntensity={0.05} />
                {/* Group 1: sides and bevels — darker ink, so the depth reads without any colour. */}
                <meshPhysicalMaterial attach="material-1" color="#080b18" roughness={0.85} metalness={0} specularIntensity={0.15} envMapIntensity={0.02} />
              </Text3D>
          </group>
        </Float>
      </group>
      <ContactShadows
        position={[0, -(box ? (box.height * scale) / 2 : 0.6) - 0.35, 0]}
        opacity={0.32}
        scale={viewport.width * 0.95}
        blur={2.8}
        far={2.2}
        resolution={1024}
        color="#15192e"
      />
    </>
  );
}
