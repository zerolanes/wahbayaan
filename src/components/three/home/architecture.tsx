"use client";

import { MeshReflectorMaterial, Sparkles, Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useSurface } from "../heritage/textures";

/** A petal rosette (phool) outline — the haveli's ornament, in place of stars. */
function rosetteShape(outer: number, inner: number, petals: number) {
  const shape = new THREE.Shape();
  const steps = petals * 12;
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    const r = inner + (outer - inner) * Math.pow(Math.abs(Math.cos((petals * a) / 2)), 0.9);
    const x = r * Math.sin(a);
    const y = r * Math.cos(a);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

/** Courtyard dimensions (metres). The camera travels down −z. */
export const COURT = { halfWidth: 8.5, start: 6, end: -46, wallHeight: 7.2, bay: 4.2 };

const SANDSTONE = "#9a4b33";
const MARBLE = "#efe6d6";

/** Two-centred (pointed) arch outline, springing at `spring`, apex at `apex`. */
function pointedArchPath(p: THREE.Path | THREE.Shape, w: number, spring: number, apex: number, bottom: number, clockwise = false) {
  const hw = w / 2;
  if (!clockwise) {
    p.moveTo(-hw, bottom);
    p.lineTo(-hw, spring);
    p.bezierCurveTo(-hw, spring + (apex - spring) * 0.55, -hw * 0.35, apex - (apex - spring) * 0.08, 0, apex);
    p.bezierCurveTo(hw * 0.35, apex - (apex - spring) * 0.08, hw, spring + (apex - spring) * 0.55, hw, spring);
    p.lineTo(hw, bottom);
    p.lineTo(-hw, bottom);
  } else {
    p.moveTo(-hw, bottom);
    p.lineTo(hw, bottom);
    p.lineTo(hw, spring);
    p.bezierCurveTo(hw, spring + (apex - spring) * 0.55, hw * 0.35, apex - (apex - spring) * 0.08, 0, apex);
    p.bezierCurveTo(-hw * 0.35, apex - (apex - spring) * 0.08, -hw, spring + (apex - spring) * 0.55, -hw, spring);
    p.lineTo(-hw, bottom);
  }
  return p;
}

function useArcadeGeometries() {
  return useMemo(() => {
    const { bay, wallHeight } = COURT;
    const archW = bay * 0.62;
    const spring = wallHeight * 0.48;
    const apex = wallHeight * 0.78;
    // Bay wall with a pointed opening
    const wall = new THREE.Shape();
    wall.moveTo(-bay / 2, 0);
    wall.lineTo(bay / 2, 0);
    wall.lineTo(bay / 2, wallHeight);
    wall.lineTo(-bay / 2, wallHeight);
    wall.closePath();
    wall.holes.push(pointedArchPath(new THREE.Path(), archW, spring, apex, 0, true));
    const wallGeo = new THREE.ExtrudeGeometry(wall, { depth: 0.9, bevelEnabled: false, curveSegments: 16 });
    wallGeo.translate(0, 0, -0.45);
    // Marble inlay around the arch
    const trim = new THREE.Shape();
    pointedArchPath(trim, archW + 0.36, spring, apex + 0.28, 0);
    trim.holes.push(pointedArchPath(new THREE.Path(), archW, spring, apex, 0, true));
    const trimGeo = new THREE.ExtrudeGeometry(trim, { depth: 0.06, bevelEnabled: false, curveSegments: 16 });
    // Spandrel medallion (eight-petal rosette)
    const star = rosetteShape(0.36, 0.17, 8);
    const starGeo = new THREE.ExtrudeGeometry(star, { depth: 0.05, bevelEnabled: false });
    return { wallGeo, trimGeo, starGeo, archW, spring, apex };
  }, []);
}

let glowTexture: THREE.Texture | null = null;
/** Soft radial glow drawn once on a canvas; used as an additive sprite around lights. */
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,210,150,1)");
  grad.addColorStop(0.25, "rgba(255,170,90,0.55)");
  grad.addColorStop(1, "rgba(255,140,60,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

export function Glow({ scale = 1.4, opacity = 0.8, color = "#ffb870" }: { scale?: number; opacity?: number; color?: string }) {
  const map = useMemo(() => getGlowTexture(), []);
  return (
    <sprite scale={[scale, scale, 1]}>
      <spriteMaterial map={map} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

function Lantern({ lit = true }: { lit?: boolean }) {
  return (
    <group>
      {lit ? <Glow scale={1.6} opacity={0.75} /> : null}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 1.1, 4]} />
        <meshStandardMaterial color="#3a2a1e" />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.16, 0.2, 0.42, 8, 1, true]} />
        <meshStandardMaterial color="#ffc27a" emissive="#ff8f2e" emissiveIntensity={lit ? 3.2 : 0.4} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <coneGeometry args={[0.22, 0.18, 8]} />
        <meshStandardMaterial color="#b8893b" metalness={0.9} roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.24, 0]}>
        <coneGeometry args={[0.2, 0.12, 8]} />
        <meshStandardMaterial color="#b8893b" metalness={0.9} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Arcade({ side, lowDetail }: { side: -1 | 1; lowDetail?: boolean }) {
  const { wallGeo, trimGeo, starGeo, archW, spring, apex } = useArcadeGeometries();
  const bays = useMemo(() => {
    const out: number[] = [];
    for (let z = COURT.start - COURT.bay / 2; z > COURT.end + COURT.bay; z -= COURT.bay) out.push(z);
    return out;
  }, []);
  const sandstone = useMemo(() => new THREE.MeshStandardMaterial({ color: SANDSTONE, roughness: 0.78 }), []);
  const marble = useMemo(() => new THREE.MeshStandardMaterial({ color: MARBLE, roughness: 0.4 }), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d4ac5a", metalness: 1, roughness: 0.3, emissive: "#6b4a12", emissiveIntensity: 0.4 }), []);
  const x = side * COURT.halfWidth;
  return (
    <group>
      {bays.map((z, i) => (
        <group key={z} position={[x, 0, z]} rotation={[0, (-side * Math.PI) / 2, 0]}>
          <mesh geometry={wallGeo} material={sandstone} />
          <mesh geometry={trimGeo} material={marble} position={[0, 0, 0.45]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={starGeo} material={gold} position={[s * (archW / 2 + 0.55), apex - 0.2, 0.47]} />
          ))}
          {/* Lantern hanging in every arch; only some cast real light. */}
          <group position={[0, spring + 0.2, -0.1]}>
            <Lantern lit />
            {!lowDetail && i % 3 === 1 ? <pointLight color="#ff9a52" intensity={6} distance={7} decay={2} /> : null}
          </group>
          {/* Back wall of the gallery, lit warm */}
          <mesh position={[0, COURT.wallHeight / 2, -1.8]}>
            <planeGeometry args={[COURT.bay, COURT.wallHeight]} />
            <meshStandardMaterial color="#5b2c1f" emissive="#3a1608" emissiveIntensity={0.6} roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* Parapet and kanguras along the top */}
      <mesh position={[x, COURT.wallHeight + 0.25, (COURT.start + COURT.end) / 2]} material={sandstone}>
        <boxGeometry args={[1.1, 0.5, COURT.start - COURT.end]} />
      </mesh>
      {Array.from({ length: Math.floor((COURT.start - COURT.end) / 0.9) }, (_, i) => (
        <mesh key={i} position={[x, COURT.wallHeight + 0.68, COURT.start - 0.45 - i * 0.9]} material={marble}>
          <boxGeometry args={[0.5, 0.36, 0.36]} />
        </mesh>
      ))}
    </group>
  );
}

function Chhatri({ position }: { position: [number, number, number] }) {
  const dome = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      // Onion-ish dome profile
      const r = 1.05 * Math.sin(Math.PI * t * 0.92) * (1 - t * 0.25) + 0.02;
      pts.push(new THREE.Vector2(r, t * 1.4));
    }
    return new THREE.LatheGeometry(pts, 32);
  }, []);
  return (
    <group position={position}>
      {[
        [-0.75, -0.75],
        [0.75, -0.75],
        [-0.75, 0.75],
        [0.75, 0.75],
      ].map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.9, pz]}>
          <cylinderGeometry args={[0.1, 0.12, 1.8, 10]} />
          <meshStandardMaterial color={MARBLE} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 1.9, 0]}>
        <boxGeometry args={[2, 0.2, 2]} />
        <meshStandardMaterial color={MARBLE} roughness={0.4} />
      </mesh>
      <mesh geometry={dome} position={[0, 2, 0]}>
        <meshStandardMaterial color={MARBLE} roughness={0.35} />
      </mesh>
      <mesh position={[0, 3.55, 0]}>
        <coneGeometry args={[0.06, 0.4, 8]} />
        <meshStandardMaterial color="#d4ac5a" metalness={1} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** The grand iwan at the end of the courtyard, holding a glowing carved rosette. */
function Iwan() {
  const geo = useMemo(() => {
    const w = COURT.halfWidth * 2 + 1.2;
    const h = 14;
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h);
    s.lineTo(-w / 2, h);
    s.closePath();
    s.holes.push(pointedArchPath(new THREE.Path(), 7.4, 6.2, 11.2, 0, true));
    const g = new THREE.ExtrudeGeometry(s, { depth: 1.4, bevelEnabled: false, curveSegments: 24 });
    return g;
  }, []);
  const trim = useMemo(() => {
    const s = new THREE.Shape();
    pointedArchPath(s, 8.4, 6.2, 11.9, 0);
    s.holes.push(pointedArchPath(new THREE.Path(), 7.4, 6.2, 11.2, 0, true));
    return new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 24 });
  }, []);
  const star = useMemo(() => {
    const s = rosetteShape(1.7, 0.78, 8);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.5, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3 });
  }, []);
  const starRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (starRef.current) starRef.current.rotation.z = clock.elapsedTime * 0.08;
  });
  return (
    <group position={[0, 0, COURT.end]}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={SANDSTONE} roughness={0.8} />
      </mesh>
      <mesh geometry={trim} position={[0, 0, 1.42]}>
        <meshStandardMaterial color={MARBLE} roughness={0.4} />
      </mesh>
      <mesh position={[0, 5.5, -1.5]}>
        <planeGeometry args={[9, 12]} />
        <meshStandardMaterial color="#1a1030" emissive="#2a1848" emissiveIntensity={0.6} />
      </mesh>
      <group position={[0, 8.7, 0.6]}>
        <Glow scale={6.5} opacity={0.4} color="#ffd48a" />
      </group>
      <mesh ref={starRef} geometry={star} position={[0, 8.7, 0.3]} scale={0.8}>
        <meshStandardMaterial color="#f0cf7e" emissive="#e0a940" emissiveIntensity={2.2} metalness={0.8} roughness={0.25} />
      </mesh>
      <pointLight position={[0, 8.2, 2.5]} color="#ffcf7a" intensity={26} distance={22} decay={2} />
    </group>
  );
}

/** Char-bagh water channel down the middle, with a slow shimmer. */
function WaterChannel() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });
  const len = COURT.start - COURT.end - 2;
  return (
    <group position={[0, 0, (COURT.start + COURT.end) / 2 - 1]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[1.9, len, 1, 1]} />
        <shaderMaterial
          ref={mat}
          uniforms={uniforms}
          transparent
          vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
          fragmentShader={`
            varying vec2 vUv; uniform float uTime;
            void main(){
              float w = sin(vUv.y*260.0 - uTime*1.6)*0.5+0.5;
              float w2 = sin(vUv.y*97.0 + vUv.x*18.0 + uTime*0.9)*0.5+0.5;
              float glint = smoothstep(0.93, 1.0, w*w2);
              vec3 deep = vec3(0.05,0.08,0.2);
              vec3 col = mix(deep, vec3(0.16,0.25,0.5), w2*0.35) + glint*vec3(1.0,0.8,0.5)*0.9;
              gl_FragColor = vec4(col, 0.92);
            }`}
        />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.05, 0.06, 0]}>
          <boxGeometry args={[0.2, 0.12, len]} />
          <meshStandardMaterial color={MARBLE} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Sky() {
  const uniforms = useMemo(() => ({}), []);
  return (
    <group>
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[120, 32, 16]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={uniforms}
          vertexShader={`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
          fragmentShader={`
            varying vec3 vDir;
            void main(){
              float h = clamp(vDir.y, -0.1, 1.0);
              vec3 top = vec3(0.03,0.04,0.12);
              vec3 mid = vec3(0.1,0.1,0.27);
              vec3 horizon = vec3(0.55,0.27,0.22);
              vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
              col = mix(col, top, smoothstep(0.18, 0.7, h));
              gl_FragColor = vec4(col, 1.0);
            }`}
        />
      </mesh>
      <Stars radius={90} depth={30} count={2500} factor={4} saturation={0} fade speed={0.4} />
      {/* Crescent moon */}
      <group position={[-28, 38, -80]}>
        <mesh>
          <sphereGeometry args={[2.6, 32, 32]} />
          <meshBasicMaterial color="#fff1c9" />
        </mesh>
        <mesh position={[0.95, 0.35, 0.6]}>
          <sphereGeometry args={[2.55, 32, 32]} />
          <meshBasicMaterial color="#0a0c1f" />
        </mesh>
      </group>
    </group>
  );
}

function Floor({ reflective }: { reflective: boolean }) {
  const map = useSurface("tile", 7, { repeat: [10, 26] });
  const len = COURT.start - COURT.end + 10;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (COURT.start + COURT.end) / 2]}>
      <planeGeometry args={[COURT.halfWidth * 2 + 2, len]} />
      {reflective ? (
        <MeshReflectorMaterial
          map={map}
          color="#9aa3c8"
          blur={[400, 120]}
          resolution={512}
          mixBlur={1}
          mixStrength={1.6}
          mirror={0.55}
          roughness={0.85}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          metalness={0.2}
        />
      ) : (
        <meshStandardMaterial map={map} color="#9aa3c8" roughness={0.5} metalness={0.1} />
      )}
    </mesh>
  );
}

export function Haveli({ lowDetail = false }: { lowDetail?: boolean }) {
  return (
    <group>
      <Sky />
      <Floor reflective={!lowDetail} />
      <WaterChannel />
      <Arcade side={-1} lowDetail={lowDetail} />
      <Arcade side={1} lowDetail={lowDetail} />
      <Iwan />
      <Chhatri position={[-COURT.halfWidth, COURT.wallHeight + 0.5, COURT.end + 1.5]} />
      <Chhatri position={[COURT.halfWidth, COURT.wallHeight + 0.5, COURT.end + 1.5]} />
      {!lowDetail ? <Chhatri position={[-COURT.halfWidth, COURT.wallHeight + 0.5, COURT.start - 1]} /> : null}
      {!lowDetail ? <Chhatri position={[COURT.halfWidth, COURT.wallHeight + 0.5, COURT.start - 1]} /> : null}
      <Sparkles count={lowDetail ? 60 : 160} scale={[COURT.halfWidth * 2, 6, COURT.start - COURT.end]} position={[0, 3, (COURT.start + COURT.end) / 2]} size={3} speed={0.25} color="#f0cf7e" opacity={0.7} />
    </group>
  );
}
