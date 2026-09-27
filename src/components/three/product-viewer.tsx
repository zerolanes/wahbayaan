"use client";

import dynamic from "next/dynamic";
import type { Model3d } from "@/lib/db/schema";

export type ProductViewerProps = {
  model: Model3d;
  /** Real dimensions in centimetres, used to scale the model and show a size reference. */
  dims: { widthCm: number | null; heightCm: number | null; depthCm: number | null };
  title: string;
  className?: string;
};

const Viewer = dynamic(() => import("./product-viewer-canvas").then((m) => m.ProductViewerCanvas), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center bg-indigo-950 text-sm text-sand-200/70">Loading 3D view…</div>,
});

/**
 * Interactive 3D view of a listing: orbit, zoom and see it at true scale.
 * `procedural` models are generated craft previews and are labelled
 * "Illustrative 3D preview"; `scan` models are GLB scans of the actual piece.
 */
export function ProductViewer3D(props: ProductViewerProps) {
  return <Viewer {...props} />;
}
