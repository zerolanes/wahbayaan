"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * Image-based lighting generated in-scene (no HDR downloads): a warm key like
 * late sun through a jharokha, a cool indigo fill and a gold rim.
 */
export function StudioEnvironment({ intensity = 1, warm = true }: { intensity?: number; warm?: boolean }) {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={["#120f18"]} />
      <Lightformer form="rect" intensity={3.2 * intensity} color={warm ? "#ffd9a8" : "#ffffff"} position={[3, 4, 4]} scale={[6, 4, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.4 * intensity} color="#8fa6ff" position={[-5, 2, 1]} scale={[4, 6, 1]} target={[0, 0, 0]} />
      <Lightformer form="ring" intensity={2.2 * intensity} color="#e2c27a" position={[0, 3, -5]} scale={3} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={0.8 * intensity} color="#ffffff" position={[0, -3, 2]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} />
    </Environment>
  );
}
