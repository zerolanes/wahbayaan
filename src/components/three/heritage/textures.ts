"use client";

import { useLoader, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

export type ArtKind3d = "rug" | "calligraphy" | "pottery" | "truckart" | "stone" | "salt" | "wood" | "print" | "ajrak" | "tile";

export const surfaceUrl = (kind: string, seed: number) => `/art/${kind}/${seed}-surface.svg`;

/** Loads a procedural art surface (SVG) as an sRGB texture. Suspends while loading. */
export function useSurface(kind: ArtKind3d, seed: number, opts: { repeat?: [number, number]; wrap?: boolean } = {}) {
  const base = useLoader(THREE.TextureLoader, surfaceUrl(kind, seed));
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const repeatKey = opts.repeat?.join(",");
  return useMemo(() => {
    const t = base.clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, maxAniso);
    if (opts.wrap || opts.repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
    }
    t.needsUpdate = true;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, maxAniso, repeatKey, opts.wrap]);
}
